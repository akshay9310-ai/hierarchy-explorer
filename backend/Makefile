CXX = g++
CXXFLAGS = -std=c++14 -Wall -Wextra -pedantic -Iinclude
LDFLAGS = -lws2_32

SRC_DIR = src
INC_DIR = include
TEST_DIR = tests

SERVER_BIN = hierarchy_server.exe
TEST_BIN = test_tree.exe

SERVER_OBJS = $(SRC_DIR)/BinaryTree.o $(SRC_DIR)/HttpServer.o $(SRC_DIR)/main.o
TEST_OBJS = $(SRC_DIR)/BinaryTree.o $(TEST_DIR)/test_tree.o

.PHONY: all server test run clean

all: server test

server: $(SERVER_BIN)

$(SERVER_BIN): $(SERVER_OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

$(SRC_DIR)/%.o: $(SRC_DIR)/%.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(TEST_DIR)/%.o: $(TEST_DIR)/%.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Header prerequisites for incremental builds
$(SRC_DIR)/BinaryTree.o: $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp
$(SRC_DIR)/HttpServer.o: $(INC_DIR)/HttpServer.hpp
$(SRC_DIR)/main.o: $(INC_DIR)/HttpServer.hpp
$(TEST_DIR)/test_tree.o: $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp

$(TEST_BIN): $(TEST_OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^

test: $(TEST_BIN)
	./$(TEST_BIN)

run: $(SERVER_BIN)
	./$(SERVER_BIN)

clean:
	-cmd /c "del /Q $(SRC_DIR)\*.o $(TEST_DIR)\*.o $(SERVER_BIN) $(TEST_BIN) 2>nul"
