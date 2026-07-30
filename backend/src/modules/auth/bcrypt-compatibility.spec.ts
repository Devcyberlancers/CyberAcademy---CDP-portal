import * as bcrypt from 'bcryptjs';

describe('legacy bcrypt compatibility', () => {
  it('verifies a password using the same $2b$ format accepted by Passlib', async () => {
    const password = 'ValidPassword@2026';
    const hash = await bcrypt.hash(password, 12);
    expect(hash.startsWith('$2')).toBe(true);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
    await expect(bcrypt.compare('wrong-password', hash)).resolves.toBe(false);
  });
});
