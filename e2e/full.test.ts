import { execSync } from "child_process";
import {
    ChangeSetStatus,
    CloudFormationClient,
    DescribeChangeSetCommand,
    DescribeStacksCommand,
    ExecutionStatus,
    StackStatus
} from "@aws-sdk/client-cloudformation";
// @ts-ignore
import { waitFor } from "./waitFor";

const STACK_NAME_PREFIX = "sls-sm-test"
const CHANGE_SET_NAME_PREFIX = "TestChangeSet"

const RESOURCE_TYPE_LAMBDA_VERSION = "AWS::Lambda::Version";

const cloudformation = new CloudFormationClient({
    region: process.env.AWS_DEFAULT_REGION
});

describe("serverless stack management", () => {
    jest.setTimeout(480 * 1000);

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const changeSetName = CHANGE_SET_NAME_PREFIX + "-" + randomSuffix;
    const stackName = STACK_NAME_PREFIX + "-" + randomSuffix;
    const fullStackName = STACK_NAME_PREFIX + "-" + randomSuffix + "-dev";

    const envs = {
        CHANGE_SET_NAME: changeSetName,
        STACK_NAME: stackName,
        AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        PATH: process.env.PATH
    }

    const stackNotExistRegExp = new RegExp(`Stack with id ${STACK_NAME_PREFIX}-[\\w\\d]{5}-dev does not exist`);
    const describeStack = new DescribeStacksCommand({
        StackName: fullStackName
    })
    const newChangeSetCmd = new DescribeChangeSetCommand({
        StackName: fullStackName,
        ChangeSetName: changeSetName
    });

    afterAll(async () => {
        execSync("cd e2e/serverless && npm run delete-stack", {
            env: envs
        }).toString();
    })

    it.skip("creates changeSetName with dynamic date if changeSetName not present", () => {
        // TODO: Create changeSetName without passing name, assert its' status and then clean up env
    })

    it("fails when printing ChangeSet and CHANGE_SET_NAME env not present and --changeSetName arg not passed", (done) => {
        try {
            execSync(`cd e2e/serverless && npm run deploy-dry-run`, {
                env: {
                    STACK_NAME: envs.STACK_NAME,
                    PATH: envs.PATH
                }
            })
            done(new Error("this should never execute"));
        } catch (e) {
            expect(e.stdout.toString()).toMatch(/Error: changeSetName not set. Set it by passing --changeSetName param or by setting changeSetName in serverless.yml. For examples check Serverless-Cloudformation-StackManager readme/);
            done();
        }
    })

    it("creates a stack and ChangeSet but does not deploy the ChangeSet", async () => {

        // Verify that stack (and thus ChangeSet) does not exist
        await expect(cloudformation.send(describeStack)).rejects.toThrow(stackNotExistRegExp);


        try {
            execSync("cd e2e/serverless && npm run deploy-change-set", {
                env: envs
            }).toString();
        } catch (e) {
            throw new Error("failed to run deploy--------------------------------\n\n" + e.stdout.toString() + "\n\n" + e.stderr.toString())
        }


        // Verify stack and ChangeSet is in correct state with correct resources and changes
        const stackRes = await cloudformation.send(describeStack);
        expect(stackRes.Stacks[0].StackStatus).toEqual(StackStatus.CREATE_COMPLETE);
        const initialChangeSet = await cloudformation.send(new DescribeChangeSetCommand({
            StackName: fullStackName,
            ChangeSetName: stackRes.Stacks[0].ChangeSetId
        }));
        expect(initialChangeSet.Status).toEqual(ChangeSetStatus.CREATE_COMPLETE)
        expect(initialChangeSet.ExecutionStatus).toEqual(ExecutionStatus.EXECUTE_COMPLETE)
        expect(initialChangeSet.Changes).toMatchSnapshot()


        await waitFor(async () => {
            const newChangeSet = await cloudformation.send(newChangeSetCmd);
            return newChangeSet.Status === ChangeSetStatus.CREATE_COMPLETE;
        }, { initialDelay: 1000 })

        const newChangeSet = await cloudformation.send(newChangeSetCmd);
        expect(newChangeSet.Status).toEqual(ChangeSetStatus.CREATE_COMPLETE);
        expect(newChangeSet.ExecutionStatus).toEqual(ExecutionStatus.AVAILABLE);
        const changesClean = newChangeSet.Changes.map((change) => {
            if (change.ResourceChange.ResourceType === RESOURCE_TYPE_LAMBDA_VERSION) {
                change.ResourceChange.LogicalResourceId = change.ResourceChange.LogicalResourceId.replace(/(HelloLambdaVersion)(.*)/, "$1");
            }
            return change;
        })
        expect(changesClean).toMatchSnapshot()
    })

    it("prints the ChangeSet using env", () => {
        try {
            const res = execSync("cd e2e/serverless && npm run deploy-dry-run -- --tableWidth=800", {
                env: envs
            }).toString();
            const randomSuffixRegexp = new RegExp(randomSuffix, 'g');
            const fixedRes = res.replace(randomSuffixRegexp, "randomSuffix").replace(/(HelloLambdaVersion)(.*)/, "$1").replace(/-{30,}/, "-".repeat(80))
            expect(fixedRes).toMatchSnapshot()
        } catch (e) {
            throw new Error("failed to run deploy-dry-run--------------------------------\n\n" + e.stdout.toString() + "\n\n" + e.stderr.toString())
        }
    })

    it("prints the ChangeSet using inline command", () => {
        try {
            const res = execSync(`cd e2e/serverless && npm run deploy-dry-run -- --changeSetName=${changeSetName} --tableWidth=800`, {
                env: {
                    ...envs,
                    CHANGE_SET_NAME: ''
                }
            }).toString();
            const randomSuffixRegexp = new RegExp(randomSuffix, 'g');
            const fixedRes = res.replace(randomSuffixRegexp, "randomSuffix").replace(/(HelloLambdaVersion)(.*)/, "$1").replace(/-{30,}/, "-".repeat(80))
            expect(fixedRes).toMatchSnapshot()
        } catch (e) {
            throw new Error("failed to run deploy-dry-run\n--------------------------------\n\n" + e.stdout.toString() + "\n\n" + e.stderr.toString())
        }
    })

    it("executes the ChangeSet", async () => {
        await waitFor(async () => {
            const newChangeSet = await cloudformation.send(newChangeSetCmd);
            return newChangeSet.ExecutionStatus === ExecutionStatus.AVAILABLE;
        }, { initialDelay: 1000 })
        const newChangeSet = await cloudformation.send(newChangeSetCmd);

        try {
            execSync("cd e2e/serverless && npm run execute-change-set", {
                env: envs
            }).toString();
        } catch (e) {
            throw new Error("failed to run execute-changeSet\n--------------------------------\n\n" + e.stdout.toString() + "\n\n" + e.stderr.toString())
        }


        // Verify stack and ChangeSet is in correct state with correct resources and changes

        await waitFor(async () => {
            const stackRes = await cloudformation.send(describeStack);
            return stackRes.Stacks[0].StackStatus === StackStatus.UPDATE_COMPLETE
        }, { initialDelay: 1000, tries: 15, interval: 5000 })

        const stackRes = await cloudformation.send(describeStack);

        expect(stackRes.Stacks[0].StackStatus).toEqual(StackStatus.UPDATE_COMPLETE);
        expect(stackRes.Stacks[0].ChangeSetId).toEqual(newChangeSet.ChangeSetId);
    })
})
