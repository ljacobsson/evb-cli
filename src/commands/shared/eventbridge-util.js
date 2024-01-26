const { EventBridgeClient, ListRulesCommand } = require("@aws-sdk/client-eventbridge");


async function* listRules(params) {
  const evb = new EventBridgeClient();
  let token;
  do {
    const listRulesParams = {
      ...params,
      NextToken: token,
    };

    const response = await evb.send(new ListRulesCommand(listRulesParams));

    yield response.Rules;

    ({ NextToken: token } = response);
  } while (token);
}
module.exports = {
  listRules,
};
