#include <lua.h>
#include <time.h>

struct timespec ts = {
	0,
	0
};

static int millitime(lua_State *L) {
	clock_gettime(CLOCK_REALTIME, &ts);
	lua_pushnumber(L, (double)1000 * ts.tv_sec + 1.0e-6 * ts.tv_nsec);
	return 1;
}

int luaopen_millitime(lua_State *L) {
	lua_pushcfunction(L, millitime);
	return 1;
}