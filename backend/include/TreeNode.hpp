#ifndef TREE_NODE_HPP
#define TREE_NODE_HPP

#include <string>

/**
 * @brief Represents a single node in the binary hierarchy tree.
 *
 * In the Left-Child Right-Sibling (LCRS) representation:
 * - left: Points to the first direct child (subordinate / eldest offspring).
 * - right: Points to the next sibling (peer / brother or sister).
 */
struct TreeNode {
    std::string id;
    std::string name;
    std::string role;
    std::string department;
    std::string parentId;
    TreeNode* left;
    TreeNode* right;

    TreeNode(const std::string& nodeId,
             const std::string& nodeName,
             const std::string& nodeRole,
             const std::string& nodeDept = "",
             const std::string& parent = "")
        : id(nodeId),
          name(nodeName),
          role(nodeRole),
          department(nodeDept),
          parentId(parent),
          left(nullptr),
          right(nullptr) {}
};

#endif // TREE_NODE_HPP
