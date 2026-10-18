CXX = g++
CXXFLAGS = -std=c++14 -Wall -Wextra -pedantic -Iinclude

SRC_DIR = src
INC_DIR = include
TEST_DIR = tests

ifeq ($(OS),Windows_NT)
    LDFLAGS = -lws2_32
    SERVER_BIN = hierarchy_server.exe
    TEST_BIN = test_tree.exe
    API_TEST_BIN = test_api.exe
    CLEAN_CMD = -cmd /c "del /Q $(SRC_DIR)\*.o $(TEST_DIR)\*.o $(SERVER_BIN) $(TEST_BIN) $(API_TEST_BIN) 2>nul"
else
    LDFLAGS =
    SERVER_BIN = hierarchy_server
    TEST_BIN = test_tree
    API_TEST_BIN = test_api
    CLEAN_CMD = rm -f $(SRC_DIR)/*.o $(TEST_DIR)/*.o $(SERVER_BIN) $(TEST_BIN) $(API_TEST_BIN)
endif

SERVER_OBJS = $(SRC_DIR)/BinaryTree.o $(SRC_DIR)/HttpServer.o $(SRC_DIR)/main.o
TEST_OBJS = $(SRC_DIR)/BinaryTree.o $(TEST_DIR)/test_tree.o
API_TEST_OBJS = $(SRC_DIR)/BinaryTree.o $(SRC_DIR)/HttpServer.o $(TEST_DIR)/test_api.o

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
$(SRC_DIR)/HttpServer.o: $(INC_DIR)/HttpServer.hpp $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp
$(SRC_DIR)/main.o: $(INC_DIR)/HttpServer.hpp $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp
$(TEST_DIR)/test_tree.o: $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp
$(TEST_DIR)/test_api.o: $(INC_DIR)/HttpServer.hpp $(INC_DIR)/BinaryTree.hpp $(INC_DIR)/TreeNode.hpp

$(TEST_BIN): $(TEST_OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^

$(API_TEST_BIN): $(API_TEST_OBJS)
	$(CXX) $(CXXFLAGS) -o $@ $^ $(LDFLAGS)

test: $(TEST_BIN) $(API_TEST_BIN)
	./$(TEST_BIN)
	./$(API_TEST_BIN)

run: $(SERVER_BIN)
	./$(SERVER_BIN)

clean:
	$(CLEAN_CMD)
