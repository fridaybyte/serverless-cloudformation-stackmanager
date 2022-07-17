import { AwsProvider } from "../createChangeSet";
import { DescribeChangeSetOutput } from "@aws-sdk/client-cloudformation";

export const getChangeSet = async (provider: AwsProvider, changeSetName: string, nextPageToken?: string): Promise<DescribeChangeSetOutput> => {
    const stackName = provider.naming.getStackName();

    return provider.request('CloudFormation', 'describeChangeSet', {
        ChangeSetName: changeSetName,
        StackName: stackName,
        ...(nextPageToken ? { NextPageToken: nextPageToken } : {})
    });
}
