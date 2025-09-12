import webuntis
from datetime import date, timedelta

s = webuntis.Session(
    #username='wkrausler',
    #password='!1WoernyIsthebest',
    server='aoide.webuntis.com',
    school='htbla-weiz',
    useragent='WebUntis Test'
)

s.login()

today = date.today()

monday = today - timedelta(days=today.weekday())

friday = monday + timedelta(days=4)

klasse = s.klassen().filter(name='5AHIT')[0]

#table = s.timetable_extended(klasse=klasse, start=monday, end=friday).to_table()
table = s.my_timetable(start=monday, end=friday).to_table()
#table = s.klassen()

print(table)

#teacher_list = s.teachers()
#for teacher in teacher_list:
#    print(teacher.id, teacher.fore_name, teacher.full_name)
