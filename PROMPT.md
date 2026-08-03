make a reddit clone named 'IIIT social'
but it will be based on a matrix server, matrix.iiit.ac.in is the server address. and everything will be done and restricted to this space: https://matrix.to/#/!dSZ1CJsPHCh78MIsqG:matrix.iiit.ac.in?via=matrix.iiit.ac.in
subreddits will be the chat rooms, each post will be simply a thread in that room
ive added a neon serverless postgres database to the project as well (vercel), but use that very judiciously, the primary source of truth for absolutely everything will be the matrix server, the database is just for caching and speed.
the ui will be minimal dark mode, reddit inspired. use the icons in the public folder ive added.
this will be hosted on social.iiith.online
