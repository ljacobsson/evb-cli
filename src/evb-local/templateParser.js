
function handleSAMFunction(resource, rules, resourceKey) {
    if (
      resource.Type === 'AWS::Serverless::Function' &&
      resource.Properties &&
      resource.Properties.Events
    ) {
      for (const eventKey of Object.keys(resource.Properties.Events)) {
        const event = resource.Properties.Events[eventKey];
        if (
          event.Type === 'EventBridgeRule' ||
          event.Type === 'CloudWatchEvent'
        ) {
          rules.push({
            Target: resourceKey,
            Name: `${eventKey} -> ${resourceKey}`,
            EventBusName: event.Properties.EventBusName || 'default',
            InputPath: event.Properties.InputPath,
            Input: event.Properties.Input,
            EventPattern: JSON.stringify(event.Properties.Pattern)
          });
        }
      }
    }
  }
  
  function handleEventsRule(resource, rules, resourceKey) {
    if (resource.Type === 'AWS::Events::Rule' && resource.Properties) {
      const rule = {
        Target: resourceKey,
        EventPattern: JSON.stringify(resource.Properties.EventPattern),
        EventBusName: resource.Properties.EventBusName || 'default'
      };
  
      for (const target of resource.Properties.Targets) {
        let targetName = '';
        if (Object.keys(target.Arn)[0].includes('GetAtt')) {
          targetName = target.Arn[Object.keys(target.Arn)[0]][0];
        } else if (Object.keys(target.Arn)[0].includes('Ref')) {
          targetName = target.Arn[Object.keys(target.Arn)[0]];
        } else {
          targetName = target.Arn.split(':').slice(-1)[0];
        }
        rules.push({
          ...rule,
          Name: `${resourceKey} -> ${targetName}`,
          InputPath: target.InputPath,
          Input: target.Input,
          InputTransformer: target.InputTransformer
        });
      }
    }
  }
  

  module.exports = {
      handleEventsRule,
      handleSAMFunction
  }