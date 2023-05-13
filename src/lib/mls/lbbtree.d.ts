/** Left-balanced binary tree, implemented using an immutable tree structure.
 * Operations that modify the tree return a new tree, leaving the original tree
 * unchanged.
 */
export declare class Leaf<T> {
    readonly data: T;
    constructor(data: T);
}
export declare class Internal<T> {
    readonly data: T;
    readonly leftChild: Leaf<T> | Internal<T>;
    readonly rightChild: Leaf<T> | Internal<T>;
    constructor(data: T, leftChild: Leaf<T> | Internal<T>, rightChild: Leaf<T> | Internal<T>);
}
export type Node<T> = Leaf<T> | Internal<T>;
/** Basic path iterator from the root of a tree to the leaf.
 */
declare class PathIterator<Val, Acc> {
    private size;
    private leafNum;
    private transform;
    private acc;
    private mask;
    constructor(size: number, leafNum: number, transform: (dir: boolean, acc: Acc) => [Val, Acc], acc: Acc);
    next(): {
        done: boolean;
        value?: Val;
    };
    [Symbol.iterator](): PathIterator<Val, Acc>;
}
declare class NodeIterator<T> implements Iterator<T> {
    private root;
    private path;
    private dirs;
    constructor(root: Node<T>);
    private pushLeftPath;
    next(): IteratorResult<T>;
}
declare class LeafIterator<T> implements Iterator<T> {
    private nodeIterator;
    private done;
    constructor(root: Node<T>);
    next(): IteratorResult<T>;
    [Symbol.iterator](): this;
}
export declare class Tree<T> implements Iterable<T> {
    readonly size: number;
    readonly root: Node<T>;
    constructor(data: T[] | [number, Node<T>]);
    [Symbol.iterator](): NodeIterator<T>;
    leaves(): LeafIterator<T>;
    leaf(leafNum: number): T;
    pathToLeafNum(leafNum: number): PathIterator<T, Node<T>>;
    coPathOfLeafNum(leafNum: number): PathIterator<Node<T>, Node<T>>;
    replacePathToLeaf(leafNum: number, values: T[], transform?: (nodeValue: T, value: T) => T): Tree<T>;
    addNode(data: T, newDataFn?: (leftChild: Node<T>, rightChild: Node<T>) => T): Tree<T>;
    private partialTree;
    private completeTree;
}
export {};
