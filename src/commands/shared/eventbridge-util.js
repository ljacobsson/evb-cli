async function* listRules(evb, params) {
  let token;
  do {
    const response = await evb
      .listRules({
        ...params,
        NextToken: token,
      })
      .promise();

    yield response.Rules;

    ({ NextToken: token } = response);
  } while (token);
}

module.exports = {
  listRules,
};
