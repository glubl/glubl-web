"use strict";
/* This is a fairly straightforward port of the example code found in the Tree
 * Math section of the MLS spec, which is licensed under the simplified BSD
 * license.
 *
 * Copyright (c) 2020 IETF Trust and the persons identified as authors of the
 * code. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * Neither the name of Internet Society, IETF or IETF Trust, nor the names of
 * specific contributors, may be used to endorse or promote products derived
 * from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS”
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonAncestor = exports.copath = exports.directPath = exports.sibling = exports.parent = exports.right = exports.left = exports.root = exports.nodeWidth = exports.level = void 0;
/* Calculating node numbers in a tree.
 *
 * https://github.com/mlswg/mls-protocol/blob/master/draft-ietf-mls-protocol.md#tree-math-tree-math
 */
/* The level of a node in the tree. Leaves are level 0, their parents are
 * level 1, etc. If a node's children are at different levels, then its
 * level is the max level of its children plus one.
 */
function level(x) {
    if ((x & 0x01) === 0) {
        return 0;
    }
    let k = 0;
    while (((x >> k) & 0x01) === 1) {
        k += 1;
    }
    return k;
}
exports.level = level;
/* The number of nodes needed to represent a tree with n leaves.
 */
function nodeWidth(n) {
    if (n === 0) {
        return 0;
    }
    else {
        return 2 * (n - 1) + 1;
    }
}
exports.nodeWidth = nodeWidth;
/* The index of the root node of a tree with n leaves.
 */
function root(n) {
    const w = nodeWidth(n);
    return (1 << Math.floor(Math.log2(w))) - 1;
}
exports.root = root;
/* The left child of an intermediate node. Note that because the tree is
 * left-balanced, there is no dependency on the size of the tree.
 */
function left(x) {
    const k = level(x);
    if (k === 0) {
        throw new Error('leaf node has no children');
    }
    return x ^ (0x01 << (k - 1));
}
exports.left = left;
/* The right child of an intermediate node. Depends on the number of
 * leaves because the straightforward calculation can take you beyond the
 * edge of the tree.
 */
function right(x, n) {
    const k = level(x);
    if (k === 0) {
        throw new Error('leaf node has no children');
    }
    let r = x ^ (0x03 << (k - 1));
    while (r >= nodeWidth(n)) {
        r = left(r);
    }
    return r;
}
exports.right = right;
/* The immediate parent of a node. May be beyond the right edge of the
 * tree.
 */
function parentStep(x) {
    const k = level(x);
    const b = (x >> (k + 1)) & 0x01;
    return (x | (1 << k)) ^ (b << (k + 1));
}
/* The parent of a node. As with the right child calculation, we have to
 * walk back until the parent is within the range of the tree.
 */
function parent(x, n) {
    if (x === root(n)) {
        throw new Error('root node has no parent');
    }
    let p = parentStep(x);
    while (p >= nodeWidth(n)) {
        p = parentStep(p);
    }
    return p;
}
exports.parent = parent;
/* The other child of the node's parent.
 */
function sibling(x, n) {
    const p = parent(x, n);
    if (x < p) {
        return right(p, n);
    }
    else {
        return left(p);
    }
}
exports.sibling = sibling;
/* The direct path of a node, ordered from leaf to root.
 */
function directPath(x, n) {
    const r = root(n);
    const d = [];
    while (x !== r) {
        x = parent(x, n);
        d.push(x);
    }
    return d;
}
exports.directPath = directPath;
/* The copath of a node, ordered from leaf to root.
 */
function copath(x, n) {
    if (x === root(n)) {
        return [];
    }
    const d = directPath(x, n);
    d.unshift(x);
    d.pop();
    return d.map(y => sibling(y, n));
}
exports.copath = copath;
/* The common ancestor of two nodes is the lowest node that is in the
 * direct paths of both leaves.
 */
function commonAncestor(x, y) {
    // Handle cases where one is an ancestor of the other
    const lx = level(x) + 1;
    const ly = level(y) + 1;
    if (lx <= ly && x >> ly == y >> ly) {
        return y;
    }
    else if (ly <= lx && x >> lx == y >> lx) {
        return x;
    }
    // Handle other cases
    let xn = x;
    let yn = y;
    let k = 0;
    while (xn != yn) {
        xn >>= 1;
        yn >>= 1;
        k += 1;
    }
    return (xn << k) + (1 << (k - 1)) - 1;
}
exports.commonAncestor = commonAncestor;
//# sourceMappingURL=treemath.js.map