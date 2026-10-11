#include "../include/BinaryTree.hpp"
#include <iostream>
#include <cassert>
#include <vector>

void testEmptyTree() {
    BinaryTree tree;
    assert(tree.isEmpty());
    assert(tree.getNodeCount() == 0);
    assert(tree.getHeight() == 0);
    assert(tree.getRoot() == nullptr);
    assert(tree.traversePreorder().empty());
    assert(tree.traverseInorder().empty());
    assert(tree.traversePostorder().empty());
    std::cout << "[PASS] Empty tree edge cases verified\n";
}

void testRootAndChildInsertion() {
    BinaryTree tree;
    bool rootOk = tree.setRoot("ceo", "Sarah Connor", "Chief Executive Officer");
    assert(rootOk);
    assert(!tree.isEmpty());
    assert(tree.getNodeCount() == 1);
    assert(tree.getHeight() == 1);

    // Cannot insert duplicate root ID
    bool duplicateRoot = tree.setRoot("ceo", "Another Sarah", "CEO");
    assert(!duplicateRoot);

    // Add first child (VP Tech) -> should attach to root->left
    bool vp1Ok = tree.addChild("ceo", "vp-tech", "John Connor", "VP Technology");
    assert(vp1Ok);
    assert(tree.getNodeCount() == 2);
    TreeNode* root = tree.getRoot();
    assert(root != nullptr);
    assert(root->left != nullptr);
    assert(root->left->id == "vp-tech");
    assert(root->right == nullptr);

    // Add second child (VP Ops) -> should attach to root->left->right (sibling chain)
    bool vp2Ok = tree.addChild("ceo", "vp-ops", "Kyle Reese", "VP Operations");
    assert(vp2Ok);
    assert(tree.getNodeCount() == 3);
    assert(root->left->right != nullptr);
    assert(root->left->right->id == "vp-ops");

    // Add subordinate to VP Tech -> root->left->left
    bool devOk = tree.addChild("vp-tech", "dev-lead", "Miles Dyson", "Lead Architect");
    assert(devOk);
    assert(tree.getNodeCount() == 4);
    assert(root->left->left != nullptr);
    assert(root->left->left->id == "dev-lead");

    // Prevent duplicate ID insertion
    bool duplicateId = tree.addChild("ceo", "dev-lead", "Imposter", "Tester");
    assert(!duplicateId);
    assert(tree.getNodeCount() == 4);

    // Prevent insertion to nonexistent parent
    bool invalidParent = tree.addChild("ghost", "intern", "Bob", "Intern");
    assert(!invalidParent);
    assert(tree.getNodeCount() == 4);

    std::cout << "[PASS] LCRS structure and integrity constraints verified\n";
}

void testTraversals() {
    /*
        Structure:
               [ceo]
               /
            [vp-tech] ── [vp-ops]
            /
          [dev-lead]

        Binary Representation:
               ceo (N)
              /
          vp-tech
          /     \
       dev-lead  vp-ops

        Preorder (N, L, R):
          1. ceo
          2. vp-tech
          3. dev-lead
          4. vp-ops

        Inorder (L, N, R):
          1. dev-lead
          2. vp-tech
          3. vp-ops
          4. ceo

        Postorder (L, R, N):
          1. dev-lead
          2. vp-ops
          3. vp-tech
          4. ceo
    */
    BinaryTree tree;
    tree.setRoot("ceo", "Sarah Connor", "CEO");
    tree.addChild("ceo", "vp-tech", "John Connor", "VP Tech");
    tree.addChild("ceo", "vp-ops", "Kyle Reese", "VP Ops");
    tree.addChild("vp-tech", "dev-lead", "Miles Dyson", "Lead Architect");

    // Preorder verification
    auto pre = tree.traversePreorder();
    assert(pre.size() == 4);
    assert(pre[0]->id == "ceo");
    assert(pre[1]->id == "vp-tech");
    assert(pre[2]->id == "dev-lead");
    assert(pre[3]->id == "vp-ops");

    // Inorder verification
    auto in = tree.traverseInorder();
    assert(in.size() == 4);
    assert(in[0]->id == "dev-lead");
    assert(in[1]->id == "vp-tech");
    assert(in[2]->id == "vp-ops");
    assert(in[3]->id == "ceo");

    // Postorder verification
    auto post = tree.traversePostorder();
    assert(post.size() == 4);
    assert(post[0]->id == "dev-lead");
    assert(post[1]->id == "vp-ops");
    assert(post[2]->id == "vp-tech");
    assert(post[3]->id == "ceo");

    std::cout << "[PASS] Preorder, Inorder, and Postorder sequence correctness verified\n";
}

void testParentLinkage() {
    BinaryTree tree;
    // 1. Root parent ID is empty
    bool rootOk = tree.setRoot("ceo", "Sarah Connor", "CEO");
    assert(rootOk);
    TreeNode* root = tree.getRoot();
    assert(root != nullptr);
    assert(root->parentId.empty());
    assert(root->parentId == "");

    // 2. Multiple siblings sharing the correct parent ID
    bool vp1Ok = tree.addChild("ceo", "vp-tech", "John Connor", "VP Tech");
    assert(vp1Ok);
    TreeNode* vpTech = tree.find("vp-tech");
    assert(vpTech != nullptr);
    assert(vpTech->parentId == "ceo");

    bool vp2Ok = tree.addChild("ceo", "vp-ops", "Kyle Reese", "VP Ops");
    assert(vp2Ok);
    TreeNode* vpOps = tree.find("vp-ops");
    assert(vpOps != nullptr);
    assert(vpOps->parentId == "ceo");
    assert(vpOps->parentId == vpTech->parentId);

    bool vp3Ok = tree.addChild("ceo", "vp-fin", "Grace", "VP Finance");
    assert(vp3Ok);
    TreeNode* vpFin = tree.find("vp-fin");
    assert(vpFin != nullptr);
    assert(vpFin->parentId == "ceo");
    assert(vpFin->parentId == vpOps->parentId);

    // Verify LCRS structure: root->left is vpTech, vpTech->right is vpOps, vpOps->right is vpFin
    assert(root->left == vpTech);
    assert(vpTech->right == vpOps);
    assert(vpOps->right == vpFin);

    // 3. Child of a non-root node
    bool devOk = tree.addChild("vp-tech", "dev-lead", "Miles Dyson", "Lead Architect");
    assert(devOk);
    TreeNode* devLead = tree.find("dev-lead");
    assert(devLead != nullptr);
    assert(devLead->parentId == "vp-tech");

    bool qaOk = tree.addChild("vp-tech", "qa-lead", "Marcus Wright", "QA Architect");
    assert(qaOk);
    TreeNode* qaLead = tree.find("qa-lead");
    assert(qaLead != nullptr);
    assert(qaLead->parentId == "vp-tech");
    assert(devLead->right == qaLead);

    // Child of a deeper non-root node
    bool engOk = tree.addChild("dev-lead", "dev-1", "Tim", "Software Engineer");
    assert(engOk);
    TreeNode* dev1 = tree.find("dev-1");
    assert(dev1 != nullptr);
    assert(dev1->parentId == "dev-lead");

    std::cout << "[PASS] Parent ID linkage (root, siblings, non-root nested) verified\n";
}

int main() {
    std::cout << "=== Running Binary Tree Engine Tests ===\n";
    testEmptyTree();
    testRootAndChildInsertion();
    testTraversals();
    testParentLinkage();
    std::cout << "=== All Unit Tests Passed Successfully! ===\n";
    return 0;
}
