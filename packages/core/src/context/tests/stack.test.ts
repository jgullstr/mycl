import { describe } from 'vitest';
import stackContext from '../stack';
import { sharedContextContract } from './sharedContextContract';

describe('stackContext', () => {
  sharedContextContract(stackContext);
});
