# r2-bucket

Creates one R2 bucket. Flare uses it as optional public storage for the 3D models when they
are served from a CDN origin other than the Pages site (set `NEXT_PUBLIC_ASSETS_URL` at build
time to switch).

The Cloudflare provider v4 cannot manage R2 CORS rules, so if the bucket is exposed through a
public bucket URL, apply `cors.json` once with the S3-compatible API:

```sh
aws s3api put-bucket-cors --bucket flare-assets --cors-configuration file://cors.json \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

By default the models ship inside the Pages build under `/models`, and this bucket is unused.
