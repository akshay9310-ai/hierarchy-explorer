#ifndef BINARY_TREE_HPP
#define BINARY_TREE_HPP

#include "TreeNode.hpp"
#include <vector>
#include <string>
#include <unordered_map>

/**
 * @brief BinaryTree ADT for managing organizational and family hierarchies.
 * Uses Left-Child Right-Sibling (LCRS) representation.
 */
class BinaryTree {
public:
    BinaryTree();
    ~BinaryTree();

    // Prevent accidental copying to enforce clean RAII ownership
    BinaryTree(const BinaryTree&) = delete;
    BinaryTree& operator=(const BinaryTree&) = delete;

    // Mutation results
    enum class UpdateResult {
        SUCCESS,
        NOT_FOUND,
        INVALID_INPUT
    };

    enum class DeleteResult {
        SUCCESS,
        NOT_FOUND,
        ROOT_NODE,
        FAILED
    };

    // Core tree operations
    bool setRoot(const std::string& id, const std::string& name, const std::string& role, const std::string& dept = "");
    bool addChild(const std::string& parentId, const std::string& id, const std::string& name, const std::string& role, const std::string& dept = "");
    UpdateResult updateMember(const std::string& id, const std::string& name, const std::string& role, const std::string& dept = "");
    DeleteResult deleteMember(const std::string& id, std::vector<std::string>& deletedIds);

    TreeNode* find(const std::string& id) const;
    TreeNode* getRoot() const;

    // Traversals on the binary representation
    std::vector<const TreeNode*> traversePreorder() const;
    std::vector<const TreeNode*> traverseInorder() const;
    std::vector<const TreeNode*> traversePostorder() const;

    // Metrics
    size_t getNodeCount() const;
    int getHeight() const;
    bool isEmpty() const;
    void clear();

private:
    TreeNode* root;
    std::unordered_map<std::string, TreeNode*> nodeRegistry;

    void destroySubtree(TreeNode* node);
    void destroySubtreeAndUnregister(TreeNode* node, std::vector<std::string>& deletedIds);
    int calculateHeight(const TreeNode* node) const;
    void preorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const;
    void inorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const;
    void postorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const;
};

#endif // BINARY_TREE_HPP
