import Serverless from 'serverless';
import { AwsProvider, createChangeSet, CreateChangeSetOptions } from "./createChangeSet";
import { executeChangeSet, ExecuteChangeSetOptions } from "./executeChangeSet";
import { printChangeSet } from "./printChangeSet";
import { getChangeSet } from "./utils/getChangeSet";
import { waitForChangeSet } from "./utils/waitForChangeSet";

type StackManagerOptions = CreateChangeSetOptions & ExecuteChangeSetOptions & {
    useChangeSets?: boolean
}

const DOC_SUFFIX = "For examples check Serverless-Cloudformation-StackManager readme";

const PLUGIN_NAME = 'serverlessCloudformationStackManager';
const USE_CHANGE_SETS = 'useChangeSets';
const CHANGE_SET_NAME_KEY = 'changeSetName';

const commonOptions = {
    'changeSetName': {
        usage:
            'name of the change set which will be executed' +
            '(e.g. "--changeSetName \'add_lambda_change_set\'" or "-n \'add_lambda_change_set\'")',
        shortcut: 'n',
        type: 'string'
    },
    'waitTime': {
        usage: 'defines in seconds how long to wait for complete status. Defaults to 90' +
            '(e.g. "--waitTime 40',
        type: 'number',
        default: 90
    },
    'tableWidth': {
        usage: 'defines width of the table outputted while printing the change set (if too small then it will wrap the table)'
    }
}

class ServerlessCloudformationStackManager {
    private readonly serverless: Serverless;
    private readonly options: StackManagerOptions;
    private readonly provider: AwsProvider;
    private shouldNotDeployOriginalValue: boolean;

    public commands: Record<string, unknown>
    public hooks: Record<string, VoidFunction>


    constructor(serverless: Serverless, options: StackManagerOptions) {
        this.provider = serverless.getProvider('aws') as any as AwsProvider;
        this.serverless = serverless;
        this.options = options;

        // For reference on JSON schema, see https://github.com/ajv-validator/ajv
        serverless.configSchemaHandler.defineTopLevelProperty(PLUGIN_NAME, {
            type: 'object',
            properties: {
                [USE_CHANGE_SETS]: { type: 'boolean' },
                [CHANGE_SET_NAME_KEY]: { type: 'string' },
            },
            required: [USE_CHANGE_SETS],
            additionalProperties: false,
        });

        this.commands = {
            'execute-change-set': {
                usage: 'Execute specified cloudformation change set',
                lifecycleEvents: ['run'],
                options: {
                    ...commonOptions
                },
            },
            'print-change-set': {
                usage: 'Outputs specified cloudformation change set',
                lifecycleEvents: ['run'],
                options: {
                    ...commonOptions
                },
            },
        };

        this.hooks = {
            'before:aws:deploy:deploy:createStack': () => console.log("Before createStack", (this.serverless.service.provider as any).shouldNotDeploy),
            'after:aws:deploy:deploy:createStack': () => console.log("After createStack", (this.serverless.service.provider as any).shouldNotDeploy),
            'before:aws:deploy:deploy:uploadArtifacts': () => console.log("Before upload", (this.serverless.service.provider as any).shouldNotDeploy),
            'after:aws:deploy:deploy:uploadArtifacts': () => console.log("After upload", (this.serverless.service.provider as any).shouldNotDeploy),
            'before:aws:deploy:deploy:updateStack': this.lockStackDeployment,
            'after:aws:deploy:deploy:updateStack': this.unlockStackDeployment,
            'execute-change-set:run': this.executeChangeSet,
            'print-change-set:run': this.printChangeSet
        };
    }

    executeChangeSet = () => {
        const options = this.getFinalOptions();
        return executeChangeSet(this.serverless, this.provider, options)
    }

    printChangeSet = async () => {
        const options = this.getFinalOptions();
        if (!options.changeSetName) {
            throw new Error("changeSetName not set. Set it by passing --changeSetName param or by setting changeSetName in serverless.yml. " + DOC_SUFFIX)
        }
        await waitForChangeSet(this.provider, options.changeSetName, options.waitTime)
        const changeSet = await getChangeSet(this.provider, options.changeSetName);
        return printChangeSet(changeSet, { tableWidth: options.tableWidth });
    }

    lockStackDeployment = () => {
        if (!this.isUsingChangeSets()) {
            return;
        }
        console.log('Change sets are in usage. Preventing deploy.');
        // @ts-ignore
        this.shouldNotDeployOriginalValue = this.serverless.service.provider.shouldNotDeploy
        // @ts-ignore
        this.serverless.service.provider.shouldNotDeploy = true
    }

    unlockStackDeployment = () => {
        if (!this.isUsingChangeSets()) {
            return;
        }
        // @ts-ignore
        this.serverless.service.provider.shouldNotDeploy = this.shouldNotDeployOriginalValue

        const changeSetName = this.getChangeSetName();
        return createChangeSet(this.serverless, this.provider, this.options, changeSetName)
    }

    getFinalOptions = () => {
        const options = {
            ...this.options,
        }
        const changeSetName = this.serverless.service.initialServerlessConfig[PLUGIN_NAME][CHANGE_SET_NAME_KEY];
        if (changeSetName) {
            options.changeSetName = changeSetName
        }
        return options;
    }

    isUsingChangeSets = () => this.serverless.service.initialServerlessConfig[PLUGIN_NAME][USE_CHANGE_SETS]
    getChangeSetName = () => this.serverless.service.initialServerlessConfig[PLUGIN_NAME][CHANGE_SET_NAME_KEY]
}

module.exports = ServerlessCloudformationStackManager;
