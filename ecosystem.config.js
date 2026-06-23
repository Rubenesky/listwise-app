module.exports = {
  apps: [
    {
      name: "listwise-next",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "listwise-trigger",
      script: "npm",
      args: "run trigger:dev",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};