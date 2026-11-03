const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculate, statusText} = require('../static/spending-insights.js');
const month = '2026-11';
const expense = (amount, category='Food', date='2026-11-02') => ({type:'expense', amount, category, date});
const budget = (amount, category='Food', period=month) => ({amount, category, month:period});

test('chart uses only selected-month expenses and groups categories', () => {
    const result = calculate([expense(25), expense(15), expense(60,'Bills'),
        expense(999,'Food','2026-10-31'), expense(999,'Food','2026-12-01'),
        {...expense(1000,'Salary'), type:'income'}], [], month);
    assert.deepEqual(result.categories, [{category:'Bills',spent:6000},{category:'Food',spent:4000}]);
    assert.equal(result.spent,10000);
});
test('overall remaining includes expenses without category limits', () => {
    const result = calculate([expense(25),expense(30,'Bills')], [budget(100),budget(999,'Food','2026-10')],month);
    assert.equal(result.limit,10000);
    assert.equal(result.remaining,4500);
    assert.equal(result.limits[0].remaining,7500);
});
for (const [amount,state,remaining] of [[79.99,'safe',2001],[80,'near',2000],[99.99,'near',1],[100,'at-limit',0],[100.01,'over',-1]]) {
    test(`exact cents at ${amount}: ${state}`,()=>{
        const result=calculate([expense(amount)], [budget(100)], month);
        assert.equal(result.status,state);
        assert.equal(result.limits[0].status,state);
        assert.equal(result.remaining,remaining);
        assert.ok(statusText(result).includes('$100.00'));
    });
}
test('add, edit category/type/date, and delete recalculate without cached totals',()=>{
    let rows=[expense(40),expense(60,'Bills')];
    assert.equal(calculate(rows,[budget(100)],month).status,'at-limit');
    rows[1]=expense(20);
    assert.deepEqual(calculate(rows,[],month).categories,[{category:'Food',spent:6000}]);
    rows[0]={...rows[0],type:'income'};
    assert.equal(calculate(rows,[],month).spent,2000);
    rows[1].date='2026-10-01';
    assert.equal(calculate(rows,[],month).spent,0);
    rows=[];
    assert.deepEqual(calculate(rows,[],month).categories,[]);
});
test('budget update changes warning and remaining immediately',()=>{
    assert.equal(calculate([expense(90)],[budget(100)],month).status,'near');
    assert.equal(calculate([expense(90)],[budget(200)],month).status,'safe');
    assert.equal(calculate([expense(90)],[budget(50)],month).remaining,-4000);
});
test('missing budgets have no invented remaining amount; decimals use cents',()=>{
    assert.equal(calculate([expense(1)],[],month).remaining,null);
    assert.equal(calculate([],[],month).status,'unset');
    assert.equal(calculate([expense(.1),expense(.2)],[budget(.3)],month).status,'at-limit');
});
