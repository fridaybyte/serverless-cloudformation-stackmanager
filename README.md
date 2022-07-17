# Serverless-Cloudformation-StackManager

Plugin for serverless that allows to create, review and execute change sets in AWS provider instead of
automatically deploying them.

## How to use?

First you need to install the plugin.   You can do this using npm e.g. `npm install serverless-cloudformation-stackmanager`.   
We recommend to:
- allow for automatic upgrade of plugin in minor version
- allow for automatic upgrade of serverless *only in patch versions* (**not minor**)    
  So your dependencies in `package.json` may look like:
```json
"dependencies": {
    "serverless": "3.21.x", // other possible syntax is "~3.21.0"
    "serverless-cloudformation-stackmanager": "1.x", // other possible syntax is "^1.0.0"
}
```

> **Warning**
> In production environment use fixed versions of serverless by using `package-lock.json` or `yarn.lock` to have a guarantee 
> that the plugin doesn't break due to internal changes in serverless which could result in automatic deployment of 
> changes instead of using change sets. You should be safe to upgrade serverless if our E2E tests passed.
> [Check also "how project guarantees that the plugin work"](#how-project-guarantees-that-the-plugin-works)

> **Note**
> In case plugin breaks, we intend to release a minor release of the plugin which would
> throw an error and this way prevent the deployment with a message. 
> This is why it's beneficial to allow for automatic minor versions upgrade.


Afterwards, define the plugin in `serverless.yml` by adding it to the plugin section. And configure the plugin by defining:   
- useChangeSets - set to true if the plugin should be used. Defaults to `false` since installing plugin shouldn't change default behaviour.
- changeSetName - here you can define name of the change set that will be created when you run `serverless deploy`. 
If you're going to use custom name then we suggest using env variable. 
This way you can use the same env variable in `print-change-set` and `execute-change-set` commands

```yaml
plugins:
- serverless-cloudformation-stackmanager

serverlessCloudformationStackManager:
  useChangeSets: true
  changeSetName: ${env:CHANGE_SET_NAME, ''}
```

Run:
- `serverless print-change-set` - to print change set in a table.     
You can adjust table width by setting arg `--tableWidth`.    
You can choose target change set by setting arg `--changeSetName`.     
Example output:
```
Action  ResourceType           LogicalResourceID
--------------------------------------------------------------------------------
Add     AWS::Lambda::Function  HelloLambdaFunction
Add     AWS::Lambda::Version   HelloLambdaVersion
Add     AWS::Logs::LogGroup    HelloLogGroup
Add     AWS::IAM::Role         IamRoleLambdaExecution
```
- `serverless execute-change-set` - to execute change set
You can choose target change set by setting arg `--changeSetName`.

You can also run `serverless execute-change-set --help` or `serverless print-change-set --help` to get reference 
to possible args and examples.

## How project guarantees that the plugin works?

Project has a scheduled action which downloads the newest version of serverless and runs E2E tests.
E2E tests deploy a sample cloudformation stack, and execute series of operations using plugin.
Tests verify cloudformation stack status and change sets (changes and status) using manual checks and snapshots to
ensure that the plugin works correctly.
Most importantly, tests check if the plugin correctly prevents automatic deployment and creates change sets instead.

This should be enough to inform us (plugin maintainers as well as users of the plugin) if the plugin still works
correctly
with the newest version of serverless and if it's safe to upgrade serverless version.

## How this plugin works?

Plugin subscribes to `before:aws:deploy:deploy:updateStack` hook. Subscriber function sets internal `shouldNotDeploy`
variable to `true`.

As you've probably guessed this prevents the deployment, but all the artifacts are already deployed since the hook is after
the `uploadArtifacts` lifecycle stage.
([check also deployment lifecycle defined by
serverless](https://github.com/serverless/serverless/blob/bb37f4fe75ff5234fae48ada433cd52ddf51cb91/lib/plugins/aws/deploy/index.js#L74-L79))

This allows us to create a change set using template which is already validated and uploaded by serverless framework.

> **Warning**
> We do not have a guarantee that serverless maintainers won't remove `shouldNotDeploy` variable or
> change its' name which would probably result in automatic deploy. (Read [How to use?](#how-to-use))

## History
Plugin was created based on ideas from:
- https://github.com/trek10inc/serverless-cloudformation-changesets and its' fork https://github.com/kandrzejczak/serverless-cloudformation-changesets
Kudos to their authors 👏🏅
 
Unfortunately, main repository hasn't been updated in a few years which makes some of its README invalid and some of 
its functionality not working as intended to.
Moreover, there is some "missing" functionality like ability to print, execute and delete change set. 

Instead of creating a fork, this project is completely rewritten. It takes the idea how to create a change set 
and prevent the deployment, but also adds missing functionality and automated full integration (E2E) tests which 
should give you a peace of mind when upgrading serverless version. 

## TODO:
We are aware that following functionality is missing or needs to improved:
- Ability to delete a specific change set
- Enhance README 😜
