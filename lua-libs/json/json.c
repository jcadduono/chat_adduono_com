#include <string.h>
#include <math.h>
#include <limits.h>
#include <lua.h>
#include <lauxlib.h>

#include "strbuf.c"
#include "fpconv.c"

#define SPARSE_RATIO 2
#define SPARSE_SAFE 10
#define ENCODE_MAX_DEPTH 1000
#define DECODE_MAX_DEPTH 1000
#define ENCODE_NUMBER_PRECISION 14

typedef enum {
	T_OBJ_BEGIN,
	T_OBJ_END,
	T_ARR_BEGIN,
	T_ARR_END,
	T_STRING,
	T_NUMBER,
	T_BOOLEAN,
	T_NULL,
	T_COLON,
	T_COMMA,
	T_END,
	T_WHITESPACE,
	T_ERROR,
	T_UNKNOWN
} json_token_type_t;

static const char *json_token_type_name[] = {
	"T_OBJ_BEGIN",
	"T_OBJ_END",
	"T_ARR_BEGIN",
	"T_ARR_END",
	"T_STRING",
	"T_NUMBER",
	"T_BOOLEAN",
	"T_NULL",
	"T_COLON",
	"T_COMMA",
	"T_END",
	"T_WHITESPACE",
	"T_ERROR",
	"T_UNKNOWN",
	NULL
};

typedef struct {
	json_token_type_t ch2token[256];
	strbuf_t encode_buf;
} json_config_t;

typedef struct {
	const char *data;
	const char *ptr;
	strbuf_t *tmp;
	json_config_t *cfg;
	int current_depth;
} json_parse_t;

typedef struct {
	json_token_type_t type;
	int index;
	union {
		const char *string;
		double number;
		int boolean;
	} value;
	int string_len;
} json_token_t;

static const char *char2escape[256] = {
	"\\u0000", "\\u0001", "\\u0002", "\\u0003",
	"\\u0004", "\\u0005", "\\u0006", "\\u0007",
	"\\b", "\\t", "\\n", "\\u000b",
	"\\f", "\\r", "\\u000e", "\\u000f",
	"\\u0010", "\\u0011", "\\u0012", "\\u0013",
	"\\u0014", "\\u0015", "\\u0016", "\\u0017",
	"\\u0018", "\\u0019", "\\u001a", "\\u001b",
	"\\u001c", "\\u001d", "\\u001e", "\\u001f",
	NULL, NULL, "\\\"", NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, "\\/",
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, "\\\\", NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, "\\u007f",
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
	NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
};

static void json_process_value(lua_State *l, json_parse_t *json, json_token_t *token);
static void json_append_data(lua_State *l, json_config_t *cfg, int current_depth, strbuf_t *json);

static json_config_t *json_fetch_config(lua_State *l) {
	json_config_t *cfg;
	
	cfg = lua_touserdata(l, lua_upvalueindex(1));
	return cfg;
}

static int json_destroy_config(lua_State *l) {
	json_config_t *cfg;
	
	cfg = lua_touserdata(l, 1);
	if (cfg) strbuf_free(&cfg->encode_buf);
	cfg = NULL;
	return 0;
}

static void json_create_config(lua_State *l) {
	json_config_t *cfg;
	int i;

	cfg = lua_newuserdata(l, sizeof(*cfg));

	lua_newtable(l);
	lua_pushcfunction(l, json_destroy_config);
	lua_setfield(l, -2, "__gc");
	lua_setmetatable(l, -2);

	strbuf_init(&cfg->encode_buf, 0);

	for (i = 0; i < 256; i++) cfg->ch2token[i] = T_ERROR;
	cfg->ch2token['{'] = T_OBJ_BEGIN;
	cfg->ch2token['}'] = T_OBJ_END;
	cfg->ch2token['['] = T_ARR_BEGIN;
	cfg->ch2token[']'] = T_ARR_END;
	cfg->ch2token[','] = T_COMMA;
	cfg->ch2token[':'] = T_COLON;
	cfg->ch2token['\0'] = T_END;
	cfg->ch2token[' '] = T_WHITESPACE;
	cfg->ch2token['\t'] = T_WHITESPACE;
	cfg->ch2token['\n'] = T_WHITESPACE;
	cfg->ch2token['\r'] = T_WHITESPACE;
	cfg->ch2token['f'] = T_UNKNOWN;
	cfg->ch2token['i'] = T_UNKNOWN;
	cfg->ch2token['I'] = T_UNKNOWN;
	cfg->ch2token['n'] = T_UNKNOWN;
	cfg->ch2token['N'] = T_UNKNOWN;
	cfg->ch2token['t'] = T_UNKNOWN;
	cfg->ch2token['"'] = T_UNKNOWN;
	cfg->ch2token['+'] = T_UNKNOWN;
	cfg->ch2token['-'] = T_UNKNOWN;
	for (i = 0; i < 10; i++) cfg->ch2token['0' + i] = T_UNKNOWN;
}

static void json_append_string(lua_State *l, strbuf_t *json, int lindex) {
	const char *escstr;
	unsigned int i;
	const char *str;
	size_t len;

	str = lua_tolstring(l, lindex, &len);

	strbuf_ensure_empty_length(json, len * 6 + 2);

	strbuf_append_char_unsafe(json, '\"');
	for (i = 0; i < len; i++) {
		escstr = char2escape[(unsigned char)str[i]];
		if (escstr) strbuf_append_string(json, escstr);
		else strbuf_append_char_unsafe(json, str[i]);
	}
	strbuf_append_char_unsafe(json, '\"');
}

static int lua_array_length(lua_State *l) {
	double k;
	int max = 0;
	int items = 0;

	lua_pushnil(l);
	while (lua_next(l, -2) != 0) {
		if (lua_type(l, -2) == LUA_TNUMBER && (k = lua_tonumber(l, -2))) {
			if (floor(k) == k && k >= 1) {
				if (k > max) max = k;
				items++;
				lua_pop(l, 1);
				continue;
			}
		}
		lua_pop(l, 2);
		return -1;
	}

	if (max > items * SPARSE_RATIO && max > SPARSE_SAFE) {
		luaL_error(l, "Cannot serialise %s: excessively sparse array", lua_typename(l, lua_type(l, -1)));
		return -1;
	}

	return max;
}

static void json_check_encode_depth(lua_State *l, int current_depth) {
	if (current_depth <= ENCODE_MAX_DEPTH && lua_checkstack(l, 3)) return;
	luaL_error(l, "Cannot serialise, excessive nesting (%d)", current_depth);
}

static void json_append_array(lua_State *l, json_config_t *cfg, int current_depth, strbuf_t *json, int array_length) {
	int comma = 0, i;

	strbuf_append_char(json, '[');
	for (i = 1; i <= array_length; i++) {
		if (comma) strbuf_append_char(json, ',');
		else comma = 1;
		lua_rawgeti(l, -1, i);
		json_append_data(l, cfg, current_depth, json);
		lua_pop(l, 1);
	}
	strbuf_append_char(json, ']');
}

static void json_append_number(lua_State *l, strbuf_t *json, int lindex) {
	double num = lua_tonumber(l, lindex);
	int len;
	
	if (isinf(num) || isnan(num)) {
		strbuf_append_mem(json, "null", 4);
		return;
	}
	strbuf_ensure_empty_length(json, FPCONV_G_FMT_BUFSIZE);
	len = fpconv_g_fmt(strbuf_empty_ptr(json), num, ENCODE_NUMBER_PRECISION);
	strbuf_extend_length(json, len);
}

static void json_append_object(lua_State *l, json_config_t *cfg, int current_depth, strbuf_t *json) {
	int comma = 0, keytype;

	strbuf_append_char(json, '{');

	lua_pushnil(l);

	while (lua_next(l, -2) != 0) {
		if (comma) strbuf_append_char(json, ',');
		else comma = 1;

		keytype = lua_type(l, -2);
		if (keytype == LUA_TNUMBER) {
			strbuf_append_char(json, '"');
			json_append_number(l, json, -2);
			strbuf_append_mem(json, "\":", 2);
		} else if (keytype == LUA_TSTRING) {
			json_append_string(l, json, -2);
			strbuf_append_char(json, ':');
		}
		else luaL_error(l, "Cannot serialise %s: table key must be a number or string", lua_typename(l, lua_type(l, -2)));
		json_append_data(l, cfg, current_depth, json);
		lua_pop(l, 1);
	}
	strbuf_append_char(json, '}');
}

static void json_append_data(lua_State *l, json_config_t *cfg, int current_depth, strbuf_t *json) {
	int len;
	
	switch (lua_type(l, -1)) {
		case LUA_TSTRING:
			json_append_string(l, json, -1);
			break;
		case LUA_TNUMBER:
			json_append_number(l, json, -1);
			break;
		case LUA_TBOOLEAN:
			if (lua_toboolean(l, -1)) strbuf_append_mem(json, "true", 4);
			else strbuf_append_mem(json, "false", 5);
			break;
		case LUA_TTABLE:
			current_depth++;
			json_check_encode_depth(l, current_depth);
			len = lua_array_length(l);
			if (len > 0) json_append_array(l, cfg, current_depth, json, len);
			else json_append_object(l, cfg, current_depth, json);
			break;
		case LUA_TNIL:
			strbuf_append_mem(json, "null", 4);
			break;
		case LUA_TLIGHTUSERDATA:
			if (lua_touserdata(l, -1) == NULL) {
				strbuf_append_mem(json, "null", 4);
				break;
			}
		default:
			luaL_error(l, "Cannot serialise %s: type not supported", lua_typename(l, lua_type(l, -1)));
	}
}

static int json_stringify(lua_State *l) {
	json_config_t *cfg = json_fetch_config(l);
	strbuf_t *encode_buf;
	char *json;
	int len;

	encode_buf = &cfg->encode_buf;
	strbuf_reset(encode_buf);

	json_append_data(l, cfg, 0, encode_buf);
	json = strbuf_string(encode_buf, &len);

	lua_pushlstring(l, json, len);

	return 1;
}

static int hexdigit2int(char hex) {
	if ('0' <= hex  && hex <= '9') return hex - '0';
	hex |= 0x20;
	if ('a' <= hex && hex <= 'f') return 10 + hex - 'a';
	return -1;
}

static int decode_hex4(const char *hex) {
	int digit[4];
	int i;

	for (i = 0; i < 4; i++) {
		digit[i] = hexdigit2int(hex[i]);
		if (digit[i] < 0) return -1;
	}

	return (digit[0] << 12) + (digit[1] << 8) + (digit[2] << 4) + digit[3];
}

static int codepoint_to_utf8(char *utf8, int codepoint) {
	if (codepoint <= 0x7F) {
		utf8[0] = codepoint;
		return 1;
	}

	if (codepoint <= 0x7FF) {
		utf8[0] = (codepoint >> 6) | 0xC0;
		utf8[1] = (codepoint & 0x3F) | 0x80;
		return 2;
	}

	if (codepoint <= 0xFFFF) {
		utf8[0] = (codepoint >> 12) | 0xE0;
		utf8[1] = ((codepoint >> 6) & 0x3F) | 0x80;
		utf8[2] = (codepoint & 0x3F) | 0x80;
		return 3;
	}

	if (codepoint <= 0x1FFFFF) {
		utf8[0] = (codepoint >> 18) | 0xF0;
		utf8[1] = ((codepoint >> 12) & 0x3F) | 0x80;
		utf8[2] = ((codepoint >> 6) & 0x3F) | 0x80;
		utf8[3] = (codepoint & 0x3F) | 0x80;
		return 4;
	}

	return 0;
}

static int json_append_unicode_escape(json_parse_t *json) {
	char utf8[4];
	int codepoint;
	int surrogate_low;
	int len;
	int escape_len = 6;

	codepoint = decode_hex4(json->ptr + 2);
	if (codepoint < 0) return -1;

	if ((codepoint & 0xF800) == 0xD800) {
		if (codepoint & 0x400) return -1;

		if (*(json->ptr + escape_len) != '\\' || *(json->ptr + escape_len + 1) != 'u') return -1;

		surrogate_low = decode_hex4(json->ptr + 2 + escape_len);
		if (surrogate_low < 0) return -1;

		if ((surrogate_low & 0xFC00) != 0xDC00) return -1;

		codepoint = (codepoint & 0x3FF) << 10;
		surrogate_low &= 0x3FF;
		codepoint = (codepoint | surrogate_low) + 0x10000;
		escape_len = 12;
	}

	len = codepoint_to_utf8(utf8, codepoint);
	if (!len) return -1;

	strbuf_append_mem_unsafe(json->tmp, utf8, len);
	json->ptr += escape_len;

	return 0;
}

static void json_set_token_error(json_token_t *token, json_parse_t *json, const char *errtype) {
	token->type = T_ERROR;
	token->index = json->ptr - json->data;
	token->value.string = errtype;
}

static void json_next_string_token(json_parse_t *json, json_token_t *token) {
	char ch;

	json->ptr++;

	strbuf_reset(json->tmp);

	while ((ch = *json->ptr) != '"') {
		if (!ch) {
			json_set_token_error(token, json, "unexpected end of string");
			return;
		}

		if (ch == '\\') {
			ch = *(json->ptr + 1);
			switch (ch) {
				case 'u':
					if (json_append_unicode_escape(json) == 0) break;
					json_set_token_error(token, json, "invalid unicode escape code");
					return;
				case '"':
				case '\\':
					break;
				case 'b':
					ch = '\b';
					break;
				case 't':
					ch = '\t';
					break;
				case 'n':
					ch = '\n';
					break;
				case 'f':
					ch = '\f';
					break;
				case 'r':
					ch = '\r';
					break;
				default:
					json_set_token_error(token, json, "invalid escape code");
					return;
			}

			json->ptr++;
		}
		strbuf_append_char_unsafe(json->tmp, ch);
		json->ptr++;
	}
	json->ptr++;

	strbuf_ensure_null(json->tmp);

	token->type = T_STRING;
	token->value.string = strbuf_string(json->tmp, &token->string_len);
}

static int json_is_invalid_number(json_parse_t *json) {
	const char *p = json->ptr;

	if (*p == '+') return 1;
	if (*p == '-') p++;
	if (*p == '0') {
		int ch2 = *(p + 1);
		if ((ch2 | 0x20) == 'x' || ('0' <= ch2 && ch2 <= '9')) return 1;
		return 0;
	}
	else if (*p <= '9') return 0;
	if (!strncasecmp(p, "inf", 3)) return 1;
	if (!strncasecmp(p, "nan", 3)) return 1;

	return 0;
}

static void json_next_number_token(json_parse_t *json, json_token_t *token) {
	char *endptr;

	token->type = T_NUMBER;
	token->value.number = fpconv_strtod(json->ptr, &endptr);
	if (json->ptr == endptr) json_set_token_error(token, json, "invalid number");
	else json->ptr = endptr;

	return;
}

static void json_next_token(json_parse_t *json, json_token_t *token) {
	const json_token_type_t *ch2token = json->cfg->ch2token;
	int ch;

	while (1) {
		ch = (unsigned char)*(json->ptr);
		token->type = ch2token[ch];
		if (token->type != T_WHITESPACE) break;
		json->ptr++;
	}

	token->index = json->ptr - json->data;

	if (token->type == T_ERROR) {
		json_set_token_error(token, json, "invalid token");
		return;
	}

	if (token->type == T_END) return;

	if (token->type != T_UNKNOWN) {
		json->ptr++;
		return;
	}

	if (ch == '"') {
		json_next_string_token(json, token);
		return;
	} else if (ch == '-' || ('0' <= ch && ch <= '9')) {
		json_next_number_token(json, token);
		return;
	} else if (!strncmp(json->ptr, "true", 4)) {
		token->type = T_BOOLEAN;
		token->value.boolean = 1;
		json->ptr += 4;
		return;
	} else if (!strncmp(json->ptr, "false", 5)) {
		token->type = T_BOOLEAN;
		token->value.boolean = 0;
		json->ptr += 5;
		return;
	} else if (!strncmp(json->ptr, "null", 4)) {
		token->type = T_NULL;
		json->ptr += 4;
		return;
	} else if (json_is_invalid_number(json)) {
		json_next_number_token(json, token);
		return;
	}

	json_set_token_error(token, json, "invalid token");
}

static void json_throw_parse_error(lua_State *l, json_parse_t *json, const char *exp, json_token_t *token) {
	const char *found;

	strbuf_free(json->tmp);

	if (token->type == T_ERROR) found = token->value.string;
	else found = json_token_type_name[token->type];

	luaL_error(l, "Expected %s but found %s at character %d", exp, found, token->index + 1);
}

static void json_parse_descend(lua_State *l, json_parse_t *json, int slots) {
	json->current_depth++;

	if (json->current_depth <= DECODE_MAX_DEPTH && lua_checkstack(l, slots)) return;

	strbuf_free(json->tmp);
	luaL_error(l, "Found too many nested data structures (%d) at character %d", json->current_depth, json->ptr - json->data);
}

static void json_parse_object_context(lua_State *l, json_parse_t *json) {
	json_token_t token;

	json_parse_descend(l, json, 3);

	lua_newtable(l);

	json_next_token(json, &token);

	if (token.type == T_OBJ_END) {
		json->current_depth--;
		return;
	}

	while (1) {
		if (token.type != T_STRING) json_throw_parse_error(l, json, "object key string", &token);

		lua_pushlstring(l, token.value.string, token.string_len);

		json_next_token(json, &token);
		if (token.type != T_COLON) json_throw_parse_error(l, json, "colon", &token);

		json_next_token(json, &token);
		json_process_value(l, json, &token);

		lua_rawset(l, -3);

		json_next_token(json, &token);

		if (token.type == T_OBJ_END) {
			json->current_depth--;
			return;
		}

		if (token.type != T_COMMA) json_throw_parse_error(l, json, "comma or object end", &token);

		json_next_token(json, &token);
	}
}

static void json_parse_array_context(lua_State *l, json_parse_t *json) {
	json_token_t token;
	int i;

	json_parse_descend(l, json, 2);

	lua_newtable(l);

	json_next_token(json, &token);

	if (token.type == T_ARR_END) {
		json->current_depth--;
		return;
	}

	for (i = 1; ; i++) {
		json_process_value(l, json, &token);
		lua_rawseti(l, -2, i);

		json_next_token(json, &token);

		if (token.type == T_ARR_END) {
			json->current_depth--;
			return;
		}

		if (token.type != T_COMMA) json_throw_parse_error(l, json, "comma or array end", &token);

		json_next_token(json, &token);
	}
}

static void json_process_value(lua_State *l, json_parse_t *json, json_token_t *token) {
	switch (token->type) {
		case T_STRING:
			lua_pushlstring(l, token->value.string, token->string_len);
			break;
		case T_NUMBER:
			lua_pushnumber(l, token->value.number);
			break;
		case T_BOOLEAN:
			lua_pushboolean(l, token->value.boolean);
			break;
		case T_OBJ_BEGIN:
			json_parse_object_context(l, json);
			break;
		case T_ARR_BEGIN:
			json_parse_array_context(l, json);
			break;
		case T_NULL:
			lua_pushlightuserdata(l, NULL);
			break;
		default:
			json_throw_parse_error(l, json, "value", token);
	}
}

static int json_parse(lua_State *l) {
	json_parse_t json;
	json_token_t token;
	size_t json_len;

	json.cfg = json_fetch_config(l);
	json.data = luaL_checklstring(l, 1, &json_len);
	json.current_depth = 0;
	json.ptr = json.data;

	if (json_len >= 2 && (!json.data[0] || !json.data[1])) luaL_error(l, "JSON parser does not support UTF-16 or UTF-32");

	json.tmp = strbuf_new(json_len);

	json_next_token(&json, &token);
	json_process_value(l, &json, &token);

	json_next_token(&json, &token);

	if (token.type != T_END) json_throw_parse_error(l, &json, "the end", &token);

	strbuf_free(json.tmp);

	return 1;
}

int luaopen_json(lua_State *l) {
	fpconv_init();

	lua_newtable(l);

	json_create_config(l);
	
	lua_pushvalue(l, -1);
	lua_pushcclosure(l, json_stringify, 1);
	lua_setfield(l, -3, "stringify");
	
	lua_pushvalue(l, -1);
	lua_pushcclosure(l, json_parse, 1);
	lua_setfield(l, -3, "parse");
	
	lua_pop(l, 1);
	
	return 1;
}