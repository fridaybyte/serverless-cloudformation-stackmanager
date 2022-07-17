type Options = {
    initialDelay?: number;
    interval?: number;
    tries?: number;

    // defines how many times in row condition must pass to resolve successfully
    stabilityCountCheck?: number;
}

const DEFAULT_INTERVAL = 3000;
const DEFAULT_TRIES_COUNT = 10;

type conditionFunc = () => Promise<boolean>;

export const waitFor = async (callback: conditionFunc, options: Options) => {
    const {
        initialDelay = 0,
    } = options;
    return new Promise<void>((resolve, reject) => {
            setTimeout(async () => {
                try {
                    await executeWait(callback, options)
                    resolve()
                } catch (e) {
                    reject(e)
                }
            }, initialDelay)
        }
    )
}


const executeWait = async (callback: conditionFunc, options: Options, currentTry = 0, stabilityCount = 0) => {
    const {
        interval = DEFAULT_INTERVAL,
        tries = DEFAULT_TRIES_COUNT,
        stabilityCountCheck = 0
    } = options
    if (currentTry >= tries) {
        throw Error("callback did not resolve successfully within specified conditions")
    }

    const res = await callback();
    if (res) {
        if (stabilityCount === stabilityCountCheck) {
            return res
        }

        return await executeWait(callback, options, 0, stabilityCount + 1)
    }

    return new Promise<void>((resolve, reject) => {
            setTimeout(async () => {
                try {
                    await executeWait(callback, options, currentTry + 1)
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }, interval)
        }
    )
}
