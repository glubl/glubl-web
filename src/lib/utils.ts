import _ from "lodash"

export const debounceByParam = (targetFunc: any, resolver: (...args: any) => any, ...debounceParams: any) =>
    _.wrap(
        _.memoize(
            () => _.debounce(targetFunc, ...debounceParams),
            resolver
        ),
        (getMemoizedFunc: any, ...params: any) =>
            getMemoizedFunc(...params)(...params)
    )
