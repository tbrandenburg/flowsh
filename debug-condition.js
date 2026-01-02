import { FlowshConditionEvaluator } from './expression-evaluator.js';

const evaluator = new FlowshConditionEvaluator();

// Test the property access issue
const testContext = {
  variables: new Map([['test_results', { passed: 10, failed: 0 }]]),
  environment: new Map([['CI', 'true']]),
  functions: new Map(),
};

// Let's see what preprocessing does
console.log('Original: ${test_results["passed"]} > 0');
console.log('Preprocessed:', evaluator.preprocessExpression('${test_results["passed"]} > 0'));

// Let's see the evaluation context
const evalContext = evaluator.prepareEvaluationContext(testContext);
console.log('Eval context:', evalContext);

// Try to evaluate with expr-eval directly
import { Parser } from 'expr-eval';
const parser = new Parser();
try {
  const processed = evaluator.preprocessExpression('${test_results["passed"]} > 0');
  console.log('Processed:', processed);

  const expr = parser.parse(processed);
  console.log('Parsed expression:', expr);

  const result = expr.evaluate(evalContext);
  console.log('Result:', result);
} catch (e) {
  console.error('Error:', e.message);
}
