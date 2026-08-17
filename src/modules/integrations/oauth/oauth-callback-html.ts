export function oauthCallbackHtml(input: {
  title: string
  message: string
  payload: Record<string, unknown>
  targetOrigins: string[]
}): string {
  const serializedPayload = JSON.stringify(input.payload)
  const serializedOrigins = JSON.stringify(input.targetOrigins)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${input.title}</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#111827;color:#f9fafb;">
  <h3 style="margin:0 0 8px;">${input.title}</h3>
  <p style="margin:0;color:#d1d5db;">${input.message}</p>
  <script>
    (function () {
      var payload = ${serializedPayload};
      var targetOrigins = ${serializedOrigins};
      if (window.opener && !window.opener.closed) {
        for (var i = 0; i < targetOrigins.length; i += 1) {
          try {
            window.opener.postMessage(payload, targetOrigins[i]);
          } catch (error) {
            void error;
          }
        }
      }
      setTimeout(function () {
        window.close();
      }, 150);
    })();
  </script>
</body>
</html>`
}
