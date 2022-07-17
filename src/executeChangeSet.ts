import Serverless, { Options } from 'serverless';
import { AwsProvider } from "./createChangeSet";
import { waitForChangeSet } from "./utils/waitForChangeSet";
import { getChangeSet } from "./utils/getChangeSet";
import { printChangeSet, PrintChangeSetOptions } from "./printChangeSet";

export type ExecuteChangeSetOptions = Options & PrintChangeSetOptions & {
    changeSetName: string;
    waitTime: number;
}

export const executeChangeSet = async (serverless: Serverless, provider: AwsProvider, options: ExecuteChangeSetOptions) => {
    const { changeSetName, waitTime, tableWidth } = options;
    const stackName = provider.naming.getStackName();
    const finalChangeSetName = changeSetName || `${stackName}-${Date.now()}`

    console.info(`Executing CloudFormation ChangeSet [${finalChangeSetName}]...`)

    await waitForChangeSet(provider, changeSetName, waitTime);
    const changeSet = await getChangeSet(provider, changeSetName);
    await printChangeSet(changeSet, { tableWidth })
    await execute(provider, options.changeSetName);
}


const execute = async (provider: AwsProvider, changeSetName: string) => {
    const stackName = provider.naming.getStackName();

    return provider.request('CloudFormation', 'executeChangeSet', {
        ChangeSetName: changeSetName,
        StackName: stackName,
    });
}
