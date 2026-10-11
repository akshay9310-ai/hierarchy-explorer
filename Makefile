.PHONY: all server test run clean frontend-build

all:
	$(MAKE) -C backend all

server:
	$(MAKE) -C backend server

test:
	$(MAKE) -C backend test

run:
	$(MAKE) -C backend run

clean:
	$(MAKE) -C backend clean

frontend-build:
	cd frontend && npm run build
