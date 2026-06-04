state = {
  user: { name: 'Administrator', email: 'admin' },
  settings: { expiringSoonDays: 3, lowStockThreshold: 3, facilityRates: { 'Football Court': 150, 'Boxing Room': 100, 'Swimming Pool': 200 }, sports: ['MMA','Boxing','Kick Boxing','Karate','Taekwondo','Gymnastic','Football','Swimming','Zumba','Summer Camp'].map((n,i)=>({name:n,enabled:true,order:i})) },
  coaches: [
    { id: 1, name: 'Mostafa', rate: 0, fixedSalary: 3000, active: 'Y' },
    { id: 2, name: 'Abdel Salam', rate: 30, fixedSalary: 0, active: 'Y' },
    { id: 3, name: 'Aya', rate: 25, fixedSalary: 0, active: 'N' },
  ],
  members: [
    { id: 10, name: 'Karim', nameArabic: 'كريم', phone: '+974 5011 1111', phone2: '+974 5041 3948', qid: '28812345678', birthdate:'2000-06-15', expiryDate: '2099-12-31', joinDate:'2026-01-01', status: 'Active', coachId: 2, enrollments: [{ sport: 'MMA', coachId: 2, classes: 12, price: 350 }], subscriptions:[{activity:'MMA',coachId:2,totalClasses:12,attendedClasses:5,amountPaid:350,start:'2026-05-01'}], dailyAttendance:{'2026-06':{'MMA':{'3':'Y','5':'Y'}}} },
    { id: 11, name: 'Sara', nameArabic: '', phone: '+974 5022 2222', qid: '', expiryDate: '2020-01-01', joinDate:'2025-01-01', status: 'Active', coachId: 2, enrollments: [{ sport: 'Karate', coachId: 2 }], subscriptions:[] },
    { id: 12, name: 'karim', nameArabic: '', phone: '+97450111111', qid: '', expiryDate: '2099-12-31', joinDate:'2026-02-01', status: 'Active', coachId: 2, enrollments: [{ sport: 'MMA', coachId: 2 }], subscriptions:[] },
    { id: 13, name: 'Mona', nameArabic: '', phone: '+974 5011 1111', qid: '', expiryDate: '2099-12-31', joinDate:'2026-02-01', status: 'Active', coachId: 1, enrollments: [{ sport: 'Swimming', coachId: 1 }], subscriptions:[] },
    { id: 14, name: 'Frozen Guy', phone: '+974 5099 9999', expiryDate: '2020-01-01', currentFreezeUntil: '2099-01-01', joinDate:'2025-06-01', status: 'Active', coachId: 1, enrollments: [{ sport: 'Boxing', coachId: 1 }], subscriptions:[] },
    { id: 15, name: 'Gone', phone: '+974 5088 8888', expiryDate: '2099-12-31', deleted: true, joinDate:'2024-01-01', status: 'Active', coachId: 1, enrollments: [], subscriptions:[] },
    { id: 16, name: 'Multi', phone: '+974 5077 7777', expiryDate: '2099-12-31', joinDate:'2026-03-01', status: 'Active', coachId: 2, enrollments: [{ sport: 'Kick Boxing', coachId: 2 }, { sport: 'Gymnastic', coachId: 1 }], subscriptions:[] },
  ],
  invoices: [
    { id: 1, ref: 'INV0001', date: '2026-06-03', month: '2026-06', amount: 350, method: 'cash', category: 'Membership', sport: 'MMA', coach:'Abdel Salam', coachId: 2, customerId: 10, customerName:'Karim' },
    { id: 2, ref: 'INV0002', date: '2026-06-03', month: '2026-06', amount: 175, method: 'cash', category: 'Membership', sport: 'Summer Camp', coachId: null, customerId: 10, customerName:'Karim' },
    { id: 3, ref: 'INV0005', date: '2026-06-03', month: '2026-06', amount: 200, method: 'card', category: 'Product', sport: null, coachId: null, customerId: 16, customerName:'Multi', lineItems:[{name:'Gloves',productId:1,qty:1,unitPrice:80,price:80}] },
  ],
  products: [
    { id: 1, name: 'Gloves', price: 80, stock: 10, lowStockThreshold: 3, category:'Gear' },
    { id: 2, name: 'Gi', price: 150, stock: 2, lowStockThreshold: 3, category:'Uniform' },
  ],
  sales: [ { id: 1, date: '2026-06-03', customerId: 16, customerName:'Multi', items: [{ productId: 1, qty: 3, unitPrice: 80 }], total:240, paid:240 } ],
  expenses: [ { id:1, date:'2026-06-01', month:'2026-06', category:'Rent', amount:5000, note:'June rent' } ],
  salaries: [],
  schedule: [ { id:1, day:'sat', hour:17, sport:'MMA', coachId:2 } ],
  rentals: [],
  trials: [ { id:1, name:'Prospect', phone:'+974 5012 0000', sport:'MMA', date:'2026-06-02', status:'pending' } ],
  audit: [ { id:1, ts:'2026-06-03T10:00:00Z', action:'member.create', actor:'admin', detail:'created Karim' } ],
};
