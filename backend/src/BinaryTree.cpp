#include "BinaryTree.hpp"
#include <algorithm>

BinaryTree::BinaryTree() : root(nullptr) {}

BinaryTree::~BinaryTree() {
    clear();
}

void BinaryTree::destroySubtree(TreeNode* node) {
    if (!node) return;
    destroySubtree(node->left);
    destroySubtree(node->right);
    delete node;
}

void BinaryTree::clear() {
    destroySubtree(root);
    root = nullptr;
    nodeRegistry.clear();
}

bool BinaryTree::isEmpty() const {
    return root == nullptr;
}

size_t BinaryTree::getNodeCount() const {
    return nodeRegistry.size();
}

TreeNode* BinaryTree::getRoot() const {
    return root;
}

TreeNode* BinaryTree::find(const std::string& id) const {
    auto it = nodeRegistry.find(id);
    if (it != nodeRegistry.end()) {
        return it->second;
    }
    return nullptr;
}

bool BinaryTree::setRoot(const std::string& id, const std::string& name, const std::string& role, const std::string& dept) {
    if (root != nullptr || nodeRegistry.find(id) != nodeRegistry.end()) {
        return false;
    }
    root = new TreeNode(id, name, role, dept);
    nodeRegistry[id] = root;
    return true;
}

bool BinaryTree::addChild(const std::string& parentId, const std::string& id, const std::string& name, const std::string& role, const std::string& dept) {
    if (nodeRegistry.find(id) != nodeRegistry.end()) {
        // Prevent duplicate ID
        return false;
    }

    TreeNode* parent = find(parentId);
    if (!parent) {
        return false;
    }

    TreeNode* newNode = new TreeNode(id, name, role, dept, parentId);
    nodeRegistry[id] = newNode;

    // LCRS: If parent has no left child, attach as first child
    if (parent->left == nullptr) {
        parent->left = newNode;
    } else {
        // Otherwise, traverse the sibling chain to the end
        TreeNode* sibling = parent->left;
        while (sibling->right != nullptr) {
            sibling = sibling->right;
        }
        sibling->right = newNode;
    }

    return true;
}

int BinaryTree::calculateHeight(const TreeNode* node) const {
    if (!node) return 0;
    return 1 + std::max(calculateHeight(node->left), calculateHeight(node->right));
}

int BinaryTree::getHeight() const {
    return calculateHeight(root);
}

void BinaryTree::preorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const {
    if (!node) return;
    result.push_back(node);
    preorderHelper(node->left, result);
    preorderHelper(node->right, result);
}

std::vector<const TreeNode*> BinaryTree::traversePreorder() const {
    std::vector<const TreeNode*> result;
    preorderHelper(root, result);
    return result;
}

void BinaryTree::inorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const {
    if (!node) return;
    inorderHelper(node->left, result);
    result.push_back(node);
    inorderHelper(node->right, result);
}

std::vector<const TreeNode*> BinaryTree::traverseInorder() const {
    std::vector<const TreeNode*> result;
    inorderHelper(root, result);
    return result;
}

void BinaryTree::postorderHelper(const TreeNode* node, std::vector<const TreeNode*>& result) const {
    if (!node) return;
    postorderHelper(node->left, result);
    postorderHelper(node->right, result);
    result.push_back(node);
}

std::vector<const TreeNode*> BinaryTree::traversePostorder() const {
    std::vector<const TreeNode*> result;
    postorderHelper(root, result);
    return result;
}
