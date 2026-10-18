#include "BinaryTree.hpp"
#include <algorithm>

void BinaryTree::swap(BinaryTree& other) {
    std::swap(root, other.root);
    nodeRegistry.swap(other.nodeRegistry);
}

bool BinaryTree::removeMember(const std::string& id) {
    TreeNode* node = find(id);
    if (!node) return false;
    if (node == root) { clear(); return true; }
    TreeNode* parent = find(node->parentId);
    TreeNode** link = &parent->left;
    while (*link && *link != node) link = &(*link)->right;
    if (!*link) return false;
    *link = node->right;
    node->right = nullptr; // A member's siblings are not its descendants.
    std::vector<const TreeNode*> removed;
    preorderHelper(node, removed);
    for (const TreeNode* item : removed) nodeRegistry.erase(item->id);
    destroySubtree(node);
    return true;
}

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
    if (id.empty() || name.empty() || root != nullptr || nodeRegistry.find(id) != nodeRegistry.end()) {
        return false;
    }
    root = new TreeNode(id, name, role, dept);
    nodeRegistry[id] = root;
    return true;
}

bool BinaryTree::addChild(const std::string& parentId, const std::string& id, const std::string& name, const std::string& role, const std::string& dept) {
    if (parentId.empty() || id.empty() || name.empty() || nodeRegistry.find(id) != nodeRegistry.end()) {
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

BinaryTree::UpdateResult BinaryTree::updateMember(const std::string& id,
                                                  const std::string& name,
                                                  const std::string& role,
                                                  const std::string& dept) {
    if (id.empty() || name.empty() || role.empty()) {
        return UpdateResult::INVALID_INPUT;
    }

    TreeNode* node = find(id);
    if (!node) {
        return UpdateResult::NOT_FOUND;
    }

    node->name = name;
    node->role = role;
    node->department = dept;
    return UpdateResult::SUCCESS;
}

void BinaryTree::destroySubtreeAndUnregister(TreeNode* node, std::vector<std::string>& deletedIds) {
    if (!node) return;
    destroySubtreeAndUnregister(node->left, deletedIds);
    destroySubtreeAndUnregister(node->right, deletedIds);
    deletedIds.push_back(node->id);
    nodeRegistry.erase(node->id);
    delete node;
}

BinaryTree::DeleteResult BinaryTree::deleteMember(const std::string& id, std::vector<std::string>& deletedIds) {
    deletedIds.clear();
    if (id.empty()) {
        return DeleteResult::NOT_FOUND;
    }

    TreeNode* target = find(id);
    if (!target) {
        return DeleteResult::NOT_FOUND;
    }

    // Structurally unsafe: Reject deleting root node
    if (target == root || target->parentId.empty()) {
        return DeleteResult::ROOT_NODE;
    }

    TreeNode* parent = find(target->parentId);
    if (!parent) {
        return DeleteResult::FAILED;
    }

    // Rewire LCRS pointers to remove target from its sibling chain
    if (parent->left == target) {
        parent->left = target->right;
    } else {
        TreeNode* prev = parent->left;
        while (prev && prev->right != target) {
            prev = prev->right;
        }
        if (!prev) {
            return DeleteResult::FAILED;
        }
        prev->right = target->right;
    }

    // Detach target from remaining siblings before deleting target and its descendants
    target->right = nullptr;

    destroySubtreeAndUnregister(target, deletedIds);

    return DeleteResult::SUCCESS;
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
