import { AwsProvider } from "../createChangeSet";
import { ExecutionStatus } from "@aws-sdk/client-cloudformation";
import { sleep } from "./sleep";
import { getChangeSet } from "./getChangeSet";

const SECOND = 1000;

export const waitForChangeSet = async (provider: AwsProvider, changeSetName: string, waitTime: number) => {
    let executionStatus = "";
    for (let i = 0; i < waitTime || 90; i++) {
        const changeSet = await getChangeSet(provider, changeSetName);

        executionStatus = changeSet.ExecutionStatus;
        if (executionStatus === ExecutionStatus.AVAILABLE) {
            console.info(`ExecutionStatus: ${executionStatus}`)
            return;
        }
        console.info(`ExecutionStatus: ${executionStatus}.. Elapsed ${i} seconds (from max ${waitTime})`)
        await sleep(SECOND);
    }
    throw new Error(`Wrong ChangeSet ExecutionStatus: ${executionStatus}`)
}
