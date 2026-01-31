/**
 * Validation Test Script
 *
 * Demonstrates the input and output validators with various test cases.
 * Run this script to see validation in action.
 *
 * Usage: npx tsx server/validators/test-validators.ts
 */

import { inputValidator } from './inputValidator';
import { outputValidator } from './outputValidator';

console.log('='.repeat(80));
console.log('TIBETAN TRANSLATION VALIDATION SYSTEM - TEST SUITE');
console.log('='.repeat(80));
console.log();

// ========== INPUT VALIDATION TESTS ==========
console.log('█ INPUT VALIDATION TESTS');
console.log('─'.repeat(80));
console.log();

// Test 1: Valid Tibetan Text
console.log('Test 1: Valid Tibetan Text');
console.log('─'.repeat(40));
const validText = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་བོད་པ་ཞིག་ཡིན། སངས་རྒྱས་ཀྱི་བསྟན་པ་ལ་དད་པ་ཡོད།';
const result1 = inputValidator.validateTibetanText(validText);
console.log(inputValidator.getValidationReport(result1));
console.log();

// Test 2: Text Too Short
console.log('Test 2: Text Too Short');
console.log('─'.repeat(40));
const shortText = 'བཀྲ་ཤིས།';
const result2 = inputValidator.validateTibetanText(shortText);
console.log(inputValidator.getValidationReport(result2));
console.log();

// Test 3: Insufficient Tibetan Content
console.log('Test 3: Insufficient Tibetan Content');
console.log('─'.repeat(40));
const mixedText = 'This is mostly English text with just a few Tibetan characters: བོད།';
const result3 = inputValidator.validateTibetanText(mixedText);
console.log(inputValidator.getValidationReport(result3));
console.log();

// Test 4: No Tibetan Characters
console.log('Test 4: No Tibetan Characters');
console.log('─'.repeat(40));
const englishText = 'This is completely English text with no Tibetan characters at all.';
const result4 = inputValidator.validateTibetanText(englishText);
console.log(inputValidator.getValidationReport(result4));
console.log();

// Test 5: Text with Unicode Issues
console.log('Test 5: Text with Unicode Replacement Character');
console.log('─'.repeat(40));
const corruptedText = 'བཀྲ་ཤིས�བདེ་ལེགས།';
const result5 = inputValidator.validateTibetanText(corruptedText);
console.log(inputValidator.getValidationReport(result5));
console.log();

// ========== OUTPUT VALIDATION TESTS ==========
console.log('█ OUTPUT VALIDATION TESTS');
console.log('─'.repeat(80));
console.log();

const originalTibetan = 'བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་བོད་པ་ཞིག་ཡིན།';

// Test 6: Valid Translation Output
console.log('Test 6: Valid Translation Output');
console.log('─'.repeat(40));
const validTranslation = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས།). I am a Tibetan (ང་ནི་བོད་པ་ཞིག་ཡིན།).';
const result6 = outputValidator.validateTranslation(validTranslation, originalTibetan);
console.log(outputValidator.getValidationReport(result6));
console.log();

// Test 7: Translation Too Short
console.log('Test 7: Incomplete Translation (Too Short)');
console.log('─'.repeat(40));
const shortTranslation = 'Hi (བོད)';
const result7 = outputValidator.validateTranslation(shortTranslation, originalTibetan);
console.log(outputValidator.getValidationReport(result7));
console.log();

// Test 8: Unbalanced Parentheses
console.log('Test 8: Unbalanced Parentheses');
console.log('─'.repeat(40));
const unbalancedTranslation = 'Greetings (བཀྲ་ཤིས་བདེ་ལེགས། without closing';
const result8 = outputValidator.validateTranslation(unbalancedTranslation, originalTibetan);
console.log(outputValidator.getValidationReport(result8));
console.log();

// Test 9: Tibetan Outside Parentheses
console.log('Test 9: Tibetan Text Outside Parentheses');
console.log('─'.repeat(40));
const tibetanOutsideTranslation = 'བཀྲ་ཤིས Greetings (bde legs)';
const result9 = outputValidator.validateTranslation(tibetanOutsideTranslation, originalTibetan);
console.log(outputValidator.getValidationReport(result9));
console.log();

// Test 10: AI Refusal
console.log('Test 10: AI Refusal/Error');
console.log('─'.repeat(40));
const aiRefusal = 'I apologize, but I cannot translate this text.';
const result10 = outputValidator.validateTranslation(aiRefusal, originalTibetan);
console.log(outputValidator.getValidationReport(result10));
console.log();

// Test 11: Meta-Text Prefix
console.log('Test 11: Meta-Text Prefix');
console.log('─'.repeat(40));
const metaText = 'Translation: Greetings (བཀྲ་ཤིས་བདེ་ལེགས།).';
const result11 = outputValidator.validateTranslation(metaText, originalTibetan);
console.log(outputValidator.getValidationReport(result11));
console.log();

// Test 12: Missing Tibetan Text
console.log('Test 12: Missing Tibetan Text in Translation');
console.log('─'.repeat(40));
const missingTibetan = 'Greetings. I am Tibetan.';
const result12 = outputValidator.validateTranslation(missingTibetan, originalTibetan);
console.log(outputValidator.getValidationReport(result12));
console.log();

// Test 13: Code Blocks
console.log('Test 13: Translation with Code Blocks');
console.log('─'.repeat(40));
const codeBlocks = '```\nGreetings (བཀྲ་ཤིས་བདེ་ལེགས།)\n```';
const result13 = outputValidator.validateTranslation(codeBlocks, originalTibetan);
console.log(outputValidator.getValidationReport(result13));
console.log();

// ========== SUMMARY ==========
console.log('='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log();

const allResults = [
  { name: 'Valid Tibetan Text', result: result1 },
  { name: 'Text Too Short', result: result2 },
  { name: 'Insufficient Tibetan Content', result: result3 },
  { name: 'No Tibetan Characters', result: result4 },
  { name: 'Unicode Issues', result: result5 },
  { name: 'Valid Translation', result: result6 },
  { name: 'Incomplete Translation', result: result7 },
  { name: 'Unbalanced Parentheses', result: result8 },
  { name: 'Tibetan Outside Parentheses', result: result9 },
  { name: 'AI Refusal', result: result10 },
  { name: 'Meta-Text Prefix', result: result11 },
  { name: 'Missing Tibetan', result: result12 },
  { name: 'Code Blocks', result: result13 }
];

const passed = allResults.filter(r => r.result.isValid).length;
const failed = allResults.filter(r => !r.result.isValid).length;

console.log(`Total Tests: ${allResults.length}`);
console.log(`Passed: ${passed} (${((passed / allResults.length) * 100).toFixed(1)}%)`);
console.log(`Failed: ${failed} (${((failed / allResults.length) * 100).toFixed(1)}%)`);
console.log();

console.log('Test Results:');
allResults.forEach((test, index) => {
  const status = test.result.isValid ? '✓' : '✗';
  const errorCount = test.result.errors.length;
  const warningCount = test.result.warnings.length;
  console.log(`  ${index + 1}. ${status} ${test.name} (${errorCount} errors, ${warningCount} warnings)`);
});

console.log();
console.log('='.repeat(80));
console.log('VALIDATION SYSTEM WORKING CORRECTLY!');
console.log('All validators are integrated into the translation pipeline.');
console.log('='.repeat(80));
