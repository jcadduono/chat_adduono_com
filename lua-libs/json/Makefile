LDFLAGS += -shared
CFLAGS ?= -I/usr/local/include/luajit-2.1 -O3 -Wall -Wextra -march=native -fomit-frame-pointer -pedantic -fpic

NAME=json

.PHONY: all install clean

all: clean $(NAME).so

$(NAME).so: $(NAME).o
	$(CC) $(LDFLAGS) -o $@ $^

install:
	cp $(NAME).so /home/nginx/lua/$(NAME).so

clean:
	rm -f *.so *.o
