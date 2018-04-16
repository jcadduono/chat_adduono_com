local ffi = require 'ffi'
local ffi_new = ffi.new
local ffi_str = ffi.string
local C = ffi.C

ffi.cdef[[
typedef unsigned long SHA_LONG;
typedef unsigned char u_char;

enum {
	SHA_LBLOCK = 16
};

typedef struct SHA256state_st {
	SHA_LONG h[8];
	SHA_LONG Nl,Nh;
	SHA_LONG data[SHA_LBLOCK];
	unsigned int num,md_len;
} SHA256_CTX;

int SHA256_Init(SHA256_CTX *c);
int SHA256_Update(SHA256_CTX *c, const void *data, size_t len);
int SHA256_Final(unsigned char *md, SHA256_CTX *c);

u_char * ngx_hex_dump(u_char *dst, const u_char *src, size_t len);
]]

local buf = ffi_new('char[?]', 32)
local ctx_ptr_type = ffi.typeof('SHA256_CTX[1]')
local str_type = ffi.typeof('uint8_t[?]')

module(...)

function generate(s)
	local ctx = ffi_new(ctx_ptr_type)
	if C.SHA256_Init(ctx) == 1 and C.SHA256_Update(ctx, s, #s) == 1 and C.SHA256_Final(buf, ctx) == 1 then
		local hex_buf = ffi_new(str_type, 64)
		C.ngx_hex_dump(hex_buf, buf, 32)
		return ffi_str(hex_buf, 64)
	end
end