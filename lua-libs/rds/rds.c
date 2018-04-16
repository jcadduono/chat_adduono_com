#include <lua.h>
 
typedef char int8_t;
typedef unsigned char uint8_t;
typedef unsigned short int uint16_t;
typedef unsigned int uint32_t;
typedef unsigned long int uint64_t;

typedef enum {
	rds_rough_col_type_int = 0 << 14,
	rds_rough_col_type_float = 1 << 14,
	rds_rough_col_type_str = 2 << 14,
	rds_rough_col_type_bool = 3 << 14
} rds_rough_col_type_t;

typedef enum {
	rds_col_type_unknown = 0 | rds_rough_col_type_str,
	rds_col_type_bigint = 1 | rds_rough_col_type_int,
	rds_col_type_bit = 2 | rds_rough_col_type_str,
	rds_col_type_bit_varying = 3 | rds_rough_col_type_str,
	rds_col_type_bool = 4 | rds_rough_col_type_bool,
	rds_col_type_char = 5 | rds_rough_col_type_str,
	rds_col_type_varchar = 6 | rds_rough_col_type_str,
	rds_col_type_date = 7 | rds_rough_col_type_str,
	rds_col_type_double = 8 | rds_rough_col_type_float,
	rds_col_type_integer = 9 | rds_rough_col_type_int,
	rds_col_type_interval = 10 | rds_rough_col_type_float,
	rds_col_type_decimal = 11 | rds_rough_col_type_float,
	rds_col_type_real = 12 | rds_rough_col_type_float,
	rds_col_type_smallint = 13 | rds_rough_col_type_int,
	rds_col_type_time_with_time_zone = 14 | rds_rough_col_type_str,
	rds_col_type_time = 15 | rds_rough_col_type_str,
	rds_col_type_timestamp_with_time_zone = 16 | rds_rough_col_type_str,
	rds_col_type_timestamp = 17 | rds_rough_col_type_str,
	rds_col_type_xml = 18 | rds_rough_col_type_str,
	rds_col_type_blob = 19 | rds_rough_col_type_str
} rds_col_type_t;

typedef struct {
	uint8_t *data;
	size_t len;
} rds_str_t;

typedef struct {
	uint8_t *start;
	uint8_t *pos;
	uint8_t *last;
	uint8_t *end;
} rds_buf_t;

typedef struct {
	uint16_t std_errcode;
	uint16_t drv_errcode;
	rds_str_t errstr;
	uint64_t affected_rows;
	uint64_t insert_id;
	uint16_t col_count;
} rds_header_t;

typedef struct rds_column_s {
	rds_col_type_t std_type;
	uint16_t drv_type;
	rds_str_t name;
} rds_column_t;

static int rds_parse_field(lua_State *L, rds_buf_t *b, rds_column_t *cols, int col) {
	lua_Number num;
	lua_Integer integer;
	size_t len = *(uint32_t *) b->pos;
	b->pos += sizeof(uint32_t);
	lua_pushvalue(L, col + 3);
	if (len == (uint32_t) -1) {
		lua_pushlightuserdata(L, NULL);
	} else {
		switch (cols[col].std_type & 0xc000) {
		case rds_rough_col_type_float:
			lua_pushlstring(L, (int8_t *) b->pos, len);
			num = lua_tonumber(L, -1);
			lua_pop(L, 1);
			lua_pushnumber(L, num);
			break;
		case rds_rough_col_type_int:
			lua_pushlstring(L, (int8_t *) b->pos, len);
			integer = lua_tointeger(L, -1);
			lua_pop(L, 1);
			lua_pushinteger(L, integer);
			break;
		case rds_rough_col_type_bool:
			if (*b->pos == '1' || *b->pos == 't' || *b->pos == 'T' ) lua_pushboolean(L, 1);
			else lua_pushboolean(L, 0);
			break;
		default:
			lua_pushlstring(L, (int8_t *) b->pos, len);
			break;
		}
		b->pos += len;
	}
	lua_rawset(L, -3);
	return 0;
}

static int rds_parse_row(lua_State *L, rds_buf_t *b, rds_header_t *header, rds_column_t *cols, int row) {
	int col, rc;
	if (*b->pos++ == 0) return 0;
	lua_createtable(L, 0, header->col_count);
	for (col = 0; col < header->col_count; col++) {
		rc = rds_parse_field(L, b, cols, col);
		if (rc == 0) continue;
		return rc;
	}
	lua_rawseti(L, -2, row + 1);
	return -2;
}

static int rds_parse_col(rds_buf_t *b, rds_column_t *col) {
	col->std_type = *(uint16_t *) b->pos;
	b->pos += sizeof(uint16_t);
	col->drv_type = *(uint16_t *) b->pos;
	b->pos += sizeof(uint16_t);
	col->name.len = *(uint16_t *) b->pos;
	b->pos += sizeof(uint16_t);
	col->name.data = b->pos;
	b->pos += col->name.len;
	return 0;
}

static int rds_parse(lua_State *L) {
	int rc = 0, i;
	rds_buf_t b;
	size_t len;
	rds_header_t h;
	rds_column_t *cols;
	b.start = (uint8_t *) lua_tolstring(L, 1, &len);
	b.end = b.start + len;
	b.pos = b.start;
	b.last = b.end;
	b.pos += sizeof(uint8_t) + sizeof(uint32_t) + 1;
	h.std_errcode = *(uint16_t *) b.pos;
	b.pos += sizeof(uint16_t);
	h.drv_errcode = *(uint16_t *) b.pos;
	b.pos += sizeof(uint16_t);
	h.errstr.len = *(uint16_t *) b.pos;
	b.pos += sizeof(uint16_t);
	h.errstr.data = b.pos;
	b.pos += h.errstr.len;
	h.affected_rows = *(uint64_t *) b.pos;
	b.pos += sizeof(uint64_t);
	h.insert_id = *(uint64_t *)b.pos;
	b.pos += sizeof(uint64_t);
	h.col_count = *(uint16_t *) b.pos;
	b.pos += sizeof(uint16_t);
	cols = lua_newuserdata(L, h.col_count * sizeof(rds_column_t));
	for (i = 0; i < h.col_count; i++) {
		rc = rds_parse_col(&b, &cols[i]);
		if (rc != 0) return rc;
		lua_pushlstring(L, (int8_t *) cols[i].name.data, cols[i].name.len);
	}
	lua_createtable(L, 0, 4);
	lua_pushinteger(L, h.std_errcode);
	lua_setfield(L, -2, "errcode");
	if (h.errstr.len > 0) {
		lua_pushlstring(L, (int8_t *) h.errstr.data, h.errstr.len);
		lua_setfield(L, -2, "errstr");
	}
	if (h.insert_id) {
		lua_pushinteger(L, h.insert_id);
		lua_setfield(L, -2, "insert_id");
	}
	if (h.affected_rows) {
		lua_pushinteger(L, h.affected_rows);
		lua_setfield(L, -2, "affected_rows");
	}
	if (h.col_count == 0) return 1;
	lua_newtable(L);
	for (i = 0; ; i++) {
		rc = rds_parse_row(L, &b, &h, cols, i);
		if (rc == -2) continue;
		if (rc == 0) break;
		return rc;
	}
	lua_setfield(L, -2, "row");
	return 1;
}

int luaopen_rds(lua_State *L) {
	lua_pushcfunction(L, rds_parse);
	return 1;
}