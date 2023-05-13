"use strict";
/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tree = exports.Internal = exports.Leaf = void 0;
/** Left-balanced binary tree, implemented using an immutable tree structure.
 * Operations that modify the tree return a new tree, leaving the original tree
 * unchanged.
 */
class Leaf {
    constructor(data) {
        this.data = data;
    }
}
exports.Leaf = Leaf;
class Internal {
    constructor(data, leftChild, rightChild) {
        this.data = data;
        this.leftChild = leftChild;
        this.rightChild = rightChild;
    }
}
exports.Internal = Internal;
/** The depth of a tree, given its size
 */
function depth(size) {
    return Math.floor(Math.log2(2 * size - 1));
}
/** Basic path iterator from the root of a tree to the leaf.
 */
class PathIterator {
    constructor(size, leafNum, transform, acc) {
        this.size = size;
        this.leafNum = leafNum;
        this.transform = transform;
        this.acc = acc;
        const d = depth(size);
        this.mask = d > 0 ? 1 << (d - 1) : 0;
    }
    next() {
        // FIXME: this needs comments
        if (this.mask < 0) {
            return { done: true };
        }
        if (this.mask == 0) {
            const [value, acc] = this.transform(undefined, this.acc);
            this.acc = acc;
            if (value != undefined) {
                this.mask = -1;
                return { done: false, value };
            }
            else {
                return { done: true };
            }
        }
        else if (this.size && this.leafNum & this.mask) {
            this.size -= this.mask;
            this.leafNum -= this.mask;
            const d = depth(this.size);
            this.mask = d > 0 ? 1 << (d - 1) : 0;
            const [value, acc] = this.transform(true, this.acc);
            this.acc = acc;
            return { done: false, value };
        }
        else {
            const dir = !this.size && !!(this.leafNum & this.mask);
            this.size = 0;
            this.mask >>= 1;
            const [value, acc] = this.transform(dir, this.acc);
            this.acc = acc;
            return { done: false, value };
        }
    }
    [Symbol.iterator]() {
        return new PathIterator(this.size, this.leafNum, this.transform, this.acc);
    }
}
class PathDirectionIterator {
    constructor(size, leafNum) {
        this.size = size;
        this.leafNum = leafNum;
    }
    [Symbol.iterator]() {
        return new PathIterator(this.size, this.leafNum, (dir, acc) => { return [dir, undefined]; }, undefined);
    }
}
class NodeIterator {
    constructor(root) {
        this.root = root;
        this.path = [root];
        this.dirs = [];
        this.pushLeftPath(root);
    }
    pushLeftPath(start) {
        for (let cur = start; cur instanceof Internal;) {
            cur = cur.leftChild;
            this.path.push(cur);
            this.dirs.push(-1);
        }
    }
    next() {
        if (this.path.length === 0) {
            // we've iterated through the whole tree
            return { done: true, value: undefined };
        }
        else if (this.dirs.length === 0) {
            // special cases where the root is a leaf node
            const node = this.path.pop();
            return { done: false, value: node.data };
        }
        const lastdir = this.dirs.pop();
        switch (lastdir) {
            case -1:
                {
                    const node = this.path.pop();
                    this.dirs.push(0);
                    return { done: false, value: node.data };
                }
            case 0:
                {
                    const node = this.path[this.path.length - 1];
                    this.dirs.push(1);
                    const rightChild = node.rightChild;
                    this.path.push(rightChild);
                    this.pushLeftPath(rightChild);
                    return { done: false, value: node.data };
                }
            case 1:
                {
                    const node = this.path.pop();
                    this.path.pop();
                    while (this.dirs.length !== 0 && this.dirs.pop() === 1) {
                        this.path.pop();
                    }
                    if (this.path.length !== 0) {
                        this.dirs.push(0);
                    }
                    return { done: false, value: node.data };
                }
        }
    }
}
class LeafIterator {
    constructor(root) {
        this.nodeIterator = new NodeIterator(root);
    }
    next() {
        if (this.done) {
            return { done: true, value: undefined };
        }
        const res = this.nodeIterator.next();
        this.done = this.nodeIterator.next().done;
        return res;
    }
    [Symbol.iterator]() {
        return this;
    }
}
function replaceNodePath(node, directions, values, fn, offset) {
    if (offset == values.length - 1) {
        return new Leaf(fn(node.data, values[offset]));
    }
    else {
        if (!(node instanceof Internal)) {
            throw new Error("Too few values specified");
        }
        else if (directions[offset]) {
            return new Internal(fn(node.data, values[offset]), node.leftChild, replaceNodePath(node.rightChild, directions, values, fn, offset + 1));
        }
        else {
            return new Internal(fn(node.data, values[offset]), replaceNodePath(node.leftChild, directions, values, fn, offset + 1), node.rightChild);
        }
    }
}
function addNode(node, size, data, newDataFn) {
    const d = depth(size);
    if (size === (1 << d)) {
        // node is the root of a full tree, so just create a new intermediate
        // node that's a parent to the old root and the node-to-be-added.
        const rightChild = new Leaf(data);
        return new Internal(newDataFn(node, rightChild), node, rightChild);
    }
    else {
        // node is not a full tree, so recurse down the right side
        const leftTreeSize = 1 << (d - 1);
        const rightChild = addNode(node.rightChild, size - leftTreeSize, data, newDataFn);
        const leftChild = node.leftChild;
        return new Internal(newDataFn(leftChild, rightChild), leftChild, rightChild);
    }
}
class Tree {
    constructor(data) {
        if (data.length === 2 &&
            typeof (data[0]) === "number" &&
            (data[1] instanceof Internal || data[1] instanceof Leaf)) {
            this.size = data[0];
            this.root = data[1];
        }
        else {
            const length = data.length;
            if (length % 2 !== 1) {
                console.log(data);
                throw new Error("Must have an odd number of nodes");
            }
            this.size = (length + 1) / 2;
            this.root = this.partialTree(data, 0, length);
        }
    }
    [Symbol.iterator]() {
        return new NodeIterator(this.root);
    }
    leaves() {
        return new LeafIterator(this.root);
    }
    leaf(leafNum) {
        let node = this.root;
        for (const dir of (new PathDirectionIterator(this.size, leafNum))) {
            if (!(node instanceof Internal)) {
                throw new Error("Tree is corrupted");
            }
            else if (dir) {
                node = node.rightChild;
            }
            else {
                node = node.leftChild;
            }
        }
        if (!(node instanceof Leaf)) {
            throw new Error("Tree is corrupted");
        }
        return node.data;
    }
    pathToLeafNum(leafNum) {
        return new PathIterator(this.size, leafNum, (dir, acc) => {
            const val = acc.data;
            if (dir === undefined) {
                return [val, acc];
            }
            else if (dir) {
                const next = acc.rightChild;
                return [val, next];
            }
            else {
                const next = acc.leftChild;
                return [val, next];
            }
        }, this.root);
    }
    coPathOfLeafNum(leafNum) {
        return new PathIterator(this.size, leafNum, (dir, acc) => {
            if (dir === undefined) {
                return [undefined, acc];
            }
            else if (dir) {
                const val = acc.leftChild;
                const next = acc.rightChild;
                return [val, next];
            }
            else {
                const val = acc.rightChild;
                const next = acc.leftChild;
                return [val, next];
            }
        }, this.root);
    }
    replacePathToLeaf(leafNum, values, transform) {
        return new Tree([
            this.size,
            replaceNodePath(this.root, [...(new PathDirectionIterator(this.size, leafNum))], values, transform || ((a, b) => b), 0),
        ]);
    }
    addNode(data, newDataFn) {
        return new Tree([
            this.size + 1,
            addNode(this.root, this.size, data, newDataFn),
        ]);
    }
    // build a (possibly) partial tree from an array of data
    partialTree(data, start, finish) {
        const numNodes = finish - start;
        if (numNodes == 1) {
            return new Leaf(data[start]);
        }
        if (numNodes < 0) {
            throw new Error("Something broke");
        }
        const numLeaves = (numNodes + 1) / 2;
        const d = depth(numLeaves);
        const numLeftTreeLeaves = 1 << (d - 1);
        const numLeftTreeNodes = 2 * numLeftTreeLeaves - 1;
        const leftChild = this.completeTree(data, start, start + numLeftTreeNodes);
        const rightChild = this.partialTree(data, start + numLeftTreeNodes + 1, finish);
        return new Internal(data[start + numLeftTreeNodes], leftChild, rightChild);
    }
    // build a complete tree from an array of data
    completeTree(data, start, finish) {
        const numNodes = finish - start;
        if (numNodes == 1) {
            return new Leaf(data[start]);
        }
        const subTreeSize = (numNodes - 1) >> 1;
        const leftChild = this.completeTree(data, start, start + subTreeSize);
        const rightChild = this.completeTree(data, start + subTreeSize + 1, finish);
        return new Internal(data[start + subTreeSize], leftChild, rightChild);
    }
}
exports.Tree = Tree;
//# sourceMappingURL=lbbtree.js.map