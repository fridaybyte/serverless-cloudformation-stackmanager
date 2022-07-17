import Serverless, {Options} from 'serverless';
import Aws, {Provider} from "serverless/aws";

export type CreateChangeSetOptions = Options & {
    changeSetName?: string;
}

const changeSetType = {
    CREATE: "CREATE",
    UPDATE: "UPDATE"
} as const;

type ChangeSetType = typeof changeSetType[keyof typeof changeSetType]

export type AwsProvider = Provider & Aws & { getDeploymentPrefix: () => Promise<string> };


export const createChangeSet = async (serverless: Serverless, provider: AwsProvider, options: CreateChangeSetOptions, changeSetName: string) => {
    const stackName = provider.naming.getStackName();
    const finalChangeSetName = changeSetName || `${stackName}-${Date.now()}`

    console.info(`Creating CloudFormation ChangeSet [${finalChangeSetName}]...`)

    try {
        await create(serverless, provider, options, stackName, finalChangeSetName, changeSetType.UPDATE)
    } catch (e) {
        if (e.message.indexOf('does not exist') > -1) {
            console.info(`Stack [${stackName}] does not exist. Creating a new empty stack...`);
            return create(serverless, provider, options, stackName, finalChangeSetName, changeSetType.CREATE)
        }
        console.error(`Unrecognized error ${e.message}`);
        throw e
    }
}

const create = async (serverless: Serverless, provider: AwsProvider, options: CreateChangeSetOptions, stackName: string, changeSetName: string, changeSetType: ChangeSetType) => {
    const compiledTemplateFileName = provider.naming.getCompiledTemplateS3Suffix();
    const serverlessDeploymentBucket = await provider.getServerlessDeploymentBucketName();

    const templateUrl = `https://s3.amazonaws.com/${serverlessDeploymentBucket}/${serverless.service.package.artifactDirectoryName}/${compiledTemplateFileName}`
    console.log("S3 Bucket Url", templateUrl);


    let stackTags = {
        STAGE: options.stage
    }
    // Merge additional stack tags
    if (typeof serverless.service.provider.stackTags === 'object') {
        stackTags = {
            ...stackTags,
            ...serverless.service.provider.stackTags
        }
    }

    const params = {
        StackName: stackName,
        ChangeSetName: changeSetName,
        Capabilities: [
            'CAPABILITY_IAM',
            'CAPABILITY_NAMED_IAM'
        ],
        ChangeSetType: changeSetType,
        Parameters: [],
        TemplateURL: templateUrl,
        Tags: Object.keys(stackTags).map((key) => ({
            Key: key,
            Value: stackTags[key]
        })),
    } as any;

    if (provider.iam?.deploymentRole) {
        params.RoleARN = provider.iam.deploymentRole;
    }

    return provider
        .request(
            'CloudFormation',
            'createChangeSet',
            params
        )
}
