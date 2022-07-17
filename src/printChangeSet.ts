import { DescribeChangeSetOutput } from "@aws-sdk/client-cloudformation";
import { Table } from "table-writer";

export type PrintChangeSetOptions = {
    tableWidth?: number;
}

export const printChangeSet = async (changeSet: DescribeChangeSetOutput, { tableWidth }: PrintChangeSetOptions = {}) => {
    console.log(`StackName: ${changeSet.StackName}, ChangeSetName: ${changeSet.ChangeSetName}`)

    const changesData = [
        ["Action", "ResourceType", "LogicalResourceID"],
        ...changeSet.Changes.map(change => {
            return [change.ResourceChange.Action, change.ResourceChange.ResourceType, change.ResourceChange.LogicalResourceId]
        })
    ]
    const changesTable = new Table(changesData, { width: tableWidth });
    console.log(changesTable.write());
}
