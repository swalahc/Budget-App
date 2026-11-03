"""Regression checks against the team's unchanged Flask APIs, using a temporary DB."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('budget_app', Path(__file__).resolve().parents[1] / 'app.py')
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

class BudgetIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.original_db = app_module.DATABASE
        app_module.DATABASE = str(Path(self.temp.name) / 'test.db')
        app_module.initialize_database()
        self.client = app_module.app.test_client()
        self.assertEqual(self.client.post('/register', data={'username':'ahmad-test','password':'test-only'}).status_code,302)
        self.assertEqual(self.client.post('/login', data={'username':'ahmad-test','password':'test-only'}).status_code,302)

    def tearDown(self):
        app_module.DATABASE = self.original_db
        self.temp.cleanup()

    def test_transactions_and_budgets(self):
        data = {'type':'expense','amount':80,'category':'Food','date':'2026-11-02','description':'test'}
        self.assertEqual(self.client.post('/api/transactions',json=data).status_code,201)
        for extra in [dict(data,type='income',category='Salary',amount=1000),dict(data,date='2026-10-31',amount=200)]:
            self.assertEqual(self.client.post('/api/transactions',json=extra).status_code,201)
        budget = {'category':'Food','month':'2026-11','amount':100}
        self.assertEqual(self.client.post('/api/budgets',json=budget).status_code,200)
        result=self.client.get('/api/budgets?month=2026-11').json[0]
        self.assertEqual((result['spent'],result['remaining'],result['percentage']),(80,20,80))
        rows=self.client.get('/api/transactions').json
        row=next(r for r in rows if r['type']=='expense' and r['date']=='2026-11-02')
        self.assertEqual(self.client.put(f"/api/transactions/{row['id']}",json=dict(data,amount=110)).status_code,200)
        self.assertEqual(self.client.get('/api/budgets?month=2026-11').json[0]['remaining'],-10)
        self.client.post('/api/budgets',json=dict(budget,amount=200))
        result=self.client.get('/api/budgets?month=2026-11').json
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]['remaining'],90)
        self.assertEqual(self.client.delete(f"/api/transactions/{row['id']}").status_code,200)
        self.assertEqual(self.client.get('/api/budgets?month=2026-11').json[0]['spent'],0)
        self.assertEqual(self.client.get('/api/budgets?month=2026-12').json,[])
        self.client.get('/logout')
        self.assertEqual(self.client.get('/api/transactions').status_code,401)
        self.assertEqual(self.client.get('/api/budgets?month=2026-11').status_code,401)

    def test_validation_and_user_isolation(self):
        self.assertEqual(self.client.post('/api/transactions',json={'type':'income','amount':1,'category':'Food','date':'2026-11-02'}).status_code,400)
        self.assertEqual(self.client.post('/api/budgets',json={'category':'Salary','month':'2026-11','amount':10}).status_code,400)
        self.assertEqual(self.client.get('/api/budgets?month=2026-13').status_code,400)
        other=app_module.app.test_client()
        other.post('/register',data={'username':'other','password':'test-only'})
        other.post('/login',data={'username':'other','password':'test-only'})
        other.post('/api/budgets',json={'category':'Food','month':'2026-11','amount':99})
        self.assertEqual(self.client.get('/api/budgets?month=2026-11').json,[])

if __name__ == '__main__':
    unittest.main()
