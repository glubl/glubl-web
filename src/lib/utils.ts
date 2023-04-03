import _ from "lodash"
import SEA from "gun/sea"
import { HashFail } from "./errors"

export const debounceByParam = (targetFunc: any, resolver: (...args: any) => any, ...debounceParams: any) =>
    _.wrap(
        _.memoize(
            () => _.debounce(targetFunc, ...debounceParams),
            resolver
        ),
        (getMemoizedFunc: any, ...params: any) =>
            getMemoizedFunc(...params)(...params)
    )

export async function getUserSpacePath(path: string, salt: string) {
    
    const pathHash1 = await SEA.work(path, null, null, {encode: "utf8", salt: salt || ""})
    const pathHash2 = await SEA.work(pathHash1, null, null, {name: "SHA-256"})

    if (!pathHash2)
        throw new HashFail()
    return pathHash2
}