#include <lua.h>
#include <time.h>

struct timespec ts = {
	0,
	0
};

static int nanoclock(lua_State *L) {
	clock_gettime(CLOCK_MONOTONIC, &ts);
	lua_pushnumber(L, (double)ts.tv_sec + 1.0e-9 * ts.tv_nsec);
	return 1;
}

int luaopen_nanoclock(lua_State *L) {
	lua_pushcfunction(L, nanoclock);
	return 1;
}