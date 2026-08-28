import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AwsSecretsManagerProvider } from '../../../../src/infrastructure/config/secrets/aws-secrets-manager.provider';

const SECRET_ID = 'image-analyzer/imagga';

interface SendMock {
  send: jest.Mock<Promise<unknown>, [{ input: unknown }]>;
}

/** Minimal stand-in for the AWS client: only `send` is ever used. */
function stubClient(behaviour: (mock: SendMock['send']) => void): SendMock {
  const send = jest.fn<Promise<unknown>, [{ input: unknown }]>();
  behaviour(send);
  return { send };
}

function clientReturning(response: unknown): SendMock {
  return stubClient((send) => send.mockResolvedValue(response));
}

function clientFailing(error: Error): SendMock {
  return stubClient((send) => send.mockRejectedValue(error));
}

function providerWith(client: SendMock): AwsSecretsManagerProvider {
  return new AwsSecretsManagerProvider(
    { secretId: SECRET_ID, region: 'us-east-1' },
    client as unknown as SecretsManagerClient,
  );
}

describe('AwsSecretsManagerProvider', () => {
  it('reads the credentials stored as JSON in the secret', async () => {
    const provider = providerWith(
      clientReturning({
        SecretString: JSON.stringify({
          IMAGGA_API_KEY: 'acc_key',
          IMAGGA_API_SECRET: 'secret',
        }),
      }),
    );

    await expect(provider.getAnnotatorCredentials()).resolves.toEqual({
      apiKey: 'acc_key',
      apiSecret: 'secret',
    });
  });

  it('requests the configured secret id', async () => {
    const client = clientReturning({
      SecretString: JSON.stringify({ IMAGGA_API_KEY: 'k', IMAGGA_API_SECRET: 's' }),
    });

    await providerWith(client).getAnnotatorCredentials();

    expect(client.send.mock.calls[0]?.[0].input).toEqual({ SecretId: SECRET_ID });
  });

  it('fetches the secret only once and reuses it', async () => {
    const client = clientReturning({
      SecretString: JSON.stringify({ IMAGGA_API_KEY: 'k', IMAGGA_API_SECRET: 's' }),
    });
    const provider = providerWith(client);

    await provider.getAnnotatorCredentials();
    await provider.getAnnotatorCredentials();

    expect(client.send).toHaveBeenCalledTimes(1);
  });

  it('explains which secret could not be read when AWS rejects the call', async () => {
    const provider = providerWith(clientFailing(new Error('AccessDeniedException')));

    await expect(provider.getAnnotatorCredentials()).rejects.toThrow(
      /Could not read secret "image-analyzer\/imagga": AccessDeniedException/,
    );
  });

  it('rejects a binary-only secret', async () => {
    const provider = providerWith(clientReturning({}));

    await expect(provider.getAnnotatorCredentials()).rejects.toThrow(/has no string value/);
  });

  it('rejects a secret that is not valid JSON', async () => {
    const provider = providerWith(clientReturning({ SecretString: 'plain-text-secret' }));

    await expect(provider.getAnnotatorCredentials()).rejects.toThrow(/is not valid JSON/);
  });

  it('rejects a secret missing the expected keys', async () => {
    const provider = providerWith(
      clientReturning({ SecretString: JSON.stringify({ API_KEY: 'wrong-shape' }) }),
    );

    await expect(provider.getAnnotatorCredentials()).rejects.toThrow(
      /must contain IMAGGA_API_KEY and IMAGGA_API_SECRET/,
    );
  });
});
