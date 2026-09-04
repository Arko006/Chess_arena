async function verify() {
  const routes = [
    'http://localhost:3000/schedule',
    'http://localhost:3000/dashboard',
    'http://localhost:3000/tournaments',
    'http://localhost:3000/api/schedule',
    'http://localhost:3000/api/dashboard',
  ];

  for (const url of routes) {
    const res = await fetch(url);
    console.log(`[STATUS ${res.status}] ${url}`);
    if (res.status !== 200) {
      throw new Error(`Route failed: ${url} with status ${res.status}`);
    }
  }
  console.log('\nALL APPLICATION PAGES & ROUTES RETURNED HTTP 200 OK!');
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
