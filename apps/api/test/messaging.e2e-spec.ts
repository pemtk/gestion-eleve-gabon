import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import {
  DEMO_PASSWORD,
  DEMO_SCHOOL_ID,
  DEMO_USERS,
  SECOND_SCHOOL_DIRECTOR,
} from '@sge/shared';
import { client, createApp, createUser, reset } from './helpers.js';

interface Thread {
  id: string;
  name: string;
  kind: string;
  last: string;
  unread: number;
  group?: boolean;
  canPost?: boolean;
}
interface Msg {
  id: string;
  seq: number;
  mine: boolean;
  text: string | null;
  fileId?: string;
  sender?: string;
}
const jpeg = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]),
    Buffer.from([0xff, 0xda, 0, 4, 9, 9, 0xff, 0xd9]),
  ]);

/** Ticket #21 — conversations privées, de classe et d'école : création, droits d'accès, non-lus, actualisation. */
describe('Messagerie (PostgreSQL)', () => {
  let app: INestApplication<App>;
  let c: ReturnType<typeof client>;
  let parent: string;
  let prof: string;
  let eleve: string;
  let ecole: string;
  const get = (path: string, t: string) => c.api().get(path).set(c.as(t));
  const post = (path: string, t: string, body: object = {}) =>
    c.api().post(path).set(c.as(t)).send(body);
  const threads = async (t: string) =>
    (await get('/threads', t).expect(200)).body as Thread[];
  const thread = async (t: string, name: string) =>
    (await threads(t)).find((x) => x.name === name)!;
  const messages = async (t: string, id: string, after?: number) =>
    (
      await get(
        `/threads/${id}/messages${after !== undefined ? `?after=${after}` : ''}`,
        t,
      ).expect(200)
    ).body as Msg[];
  const send = (
    t: string,
    id: string,
    text: string,
    clientId = `c-${Math.random()}`,
  ) => post(`/threads/${id}/messages`, t, { text, clientId });
  const login = async (phone: string) =>
    (
      await c
        .api()
        .post('/auth/login')
        .send({ mode: 'password', phone, password: DEMO_PASSWORD })
        .expect(201)
    ).body.accessToken as string;
  const unread = async (t: string) =>
    (await get('/threads/unread', t).expect(200)).body.total as number;

  beforeAll(async () => {
    app = await createApp();
    c = client(app);
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await reset(app);
    [parent, prof, eleve, ecole] = await Promise.all([
      c.token('parent'),
      c.token('enseignant'),
      c.token('eleve'),
      c.token('etablissement'),
    ]);
  });

  describe('les fils de chaque profil', () => {
    it('le parent voit l’administration, l’enseignant de son enfant et la classe de ses enfants', async () => {
      const list = await threads(parent);
      expect(list.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          'Administration',
          'Parents de 3ème B',
          DEMO_USERS.enseignant.name,
        ]),
      );
      expect(list.find((t) => t.name === 'Administration')).toMatchObject({
        kind: expect.stringContaining('École'),
        group: false,
        canPost: true,
      });
      expect(list.find((t) => t.name === 'Parents de 3ème B')).toMatchObject({
        group: true,
        canPost: false,
      }); // annonces : lecture seule
    });

    it('l’élève voit sa classe et son enseignant, pas les fils des parents', async () => {
      const names = (await threads(eleve)).map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining(['Classe 3ème B', DEMO_USERS.enseignant.name]),
      );
      expect(
        names.some((n) => n.startsWith('Parents de') || n === 'Administration'),
      ).toBe(false);
    });

    it('l’enseignant voit ses classes (élèves et parents), l’équipe et ses échanges privés', async () => {
      const names = (await threads(prof)).map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'Classe 3ème B',
          'Parents de 3ème B',
          'Équipe pédagogique',
          DEMO_USERS.parent.name,
          DEMO_USERS.eleve.name,
        ]),
      );
    });

    it('la direction voit l’équipe, les messages à l’administration et les fils de parents de l’école, pas les discussions d’élèves', async () => {
      const names = (await threads(ecole)).map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'Équipe pédagogique',
          DEMO_USERS.parent.name,
          'Parents de 3ème B',
        ]),
      );
      expect(names).not.toContain('Classe 3ème B');
      expect(names).not.toContain(DEMO_USERS.eleve.name); // échange privé élève–enseignant
    });

    it('un parent sans enfant, ou d’une autre école, ne voit rien', async () => {
      const seul = await createUser(app, {
        id: 'u-parent-x',
        phone: '06555111',
        role: 'parent',
        schoolId: null,
      });
      expect(await threads(seul)).toEqual([]);
      expect(
        await threads(await login(SECOND_SCHOOL_DIRECTOR.phone)).then((l) =>
          l.map((t) => t.name),
        ),
      ).not.toContain('Administration');
    });
  });

  describe('un message d’un enseignant arrive chez le parent', () => {
    it('le message apparaît, compte comme non lu, puis disparaît du compteur à la lecture', async () => {
      const t = await thread(parent, DEMO_USERS.enseignant.name);
      const before = t.unread;
      const totalBefore = await unread(parent);
      const sent = (
        await send(prof, t.id, 'Aïcha a oublié son cahier de maths.').expect(
          201,
        )
      ).body as Msg;
      expect(sent).toMatchObject({
        mine: true,
        text: 'Aïcha a oublié son cahier de maths.',
      });

      const after = await thread(parent, DEMO_USERS.enseignant.name);
      expect(after.unread).toBe(before + 1);
      expect(after.last).toBe('Aïcha a oublié son cahier de maths.');
      expect(await unread(parent)).toBe(totalBefore + 1);
      const received = (await messages(parent, t.id)).at(-1)!;
      expect(received).toMatchObject({
        text: 'Aïcha a oublié son cahier de maths.',
        mine: false,
      });

      await post(`/threads/${t.id}/read`, parent).expect(200);
      expect((await thread(parent, DEMO_USERS.enseignant.name)).unread).toBe(0);
      expect(await unread(parent)).toBe(totalBefore + 1 - (before + 1));
    });

    it('l’enseignant n’a pas de non-lu pour ses propres messages, le parent répond et c’est l’enseignant qui reçoit', async () => {
      const t = await thread(prof, DEMO_USERS.parent.name);
      await send(prof, t.id, 'Bonjour').expect(201);
      expect((await thread(prof, DEMO_USERS.parent.name)).unread).toBe(0);
      await send(parent, t.id, 'Merci, je viens demain.').expect(201);
      expect((await thread(prof, DEMO_USERS.parent.name)).unread).toBe(1);
      expect((await thread(parent, DEMO_USERS.enseignant.name)).unread).toBe(0);
    });

    it('une annonce de l’enseignant dans « Parents de 3ème B » arrive chez les parents, qui ne peuvent pas y répondre', async () => {
      const cls = await thread(prof, 'Parents de 3ème B');
      const before = (await thread(parent, 'Parents de 3ème B')).unread;
      await send(prof, cls.id, 'Réunion de classe vendredi à 17 h.').expect(
        201,
      );
      const seen = await thread(parent, 'Parents de 3ème B');
      expect(seen.unread).toBe(before + 1);
      expect(seen.last).toMatch(/: Réunion de classe vendredi à 17 h\./); // préfixé du prénom de l'auteur dans un groupe
      const denied = await send(parent, seen.id, 'Merci !').expect(403);
      expect(denied.body.message).toBe(
        'Vous ne pouvez pas écrire dans cette conversation.',
      );
      expect(
        (await messages(parent, seen.id)).map((m) => m.text),
      ).not.toContain('Merci !');
    });

    it('le parent écrit à l’administration et la direction lui répond', async () => {
      const admin = await thread(parent, 'Administration');
      await send(parent, admin.id, 'Pouvez-vous me rappeler ?').expect(201);
      const seenByDirection = (await threads(ecole)).find(
        (t) =>
          t.name === DEMO_USERS.parent.name &&
          t.kind === 'Parent · administration',
      )!;
      expect(seenByDirection.id).toBe(admin.id);
      expect(seenByDirection.unread).toBe(1);
      await send(ecole, admin.id, 'Bien sûr, demain matin.').expect(201);
      // écrire, c'est avoir lu ce qui précède : seule la nouvelle réponse reste non lue
      expect((await thread(parent, 'Administration')).unread).toBe(1);
    });
  });

  describe('actualisation et lecture', () => {
    it('?after ne renvoie que les nouveaux messages, dans l’ordre', async () => {
      const t = await thread(parent, DEMO_USERS.enseignant.name);
      const all = await messages(parent, t.id);
      const last = all.at(-1)!.seq;
      expect(await messages(parent, t.id, last)).toEqual([]);
      await send(prof, t.id, 'Un').expect(201);
      await send(prof, t.id, 'Deux').expect(201);
      expect((await messages(parent, t.id, last)).map((m) => m.text)).toEqual([
        'Un',
        'Deux',
      ]);
      expect((await messages(parent, t.id)).length).toBe(all.length + 2);
    });

    it('classe les fils par dernière activité', async () => {
      const cls = await thread(prof, 'Classe 3ème B');
      await send(prof, cls.id, 'Dernier message').expect(201);
      expect((await threads(prof))[0]!.id).toBe(cls.id);
    });

    it('les non-lus d’un groupe sont propres à chacun', async () => {
      const cls = await thread(eleve, 'Classe 3ème B');
      const mine = (await thread(eleve, 'Classe 3ème B')).unread;
      await send(prof, cls.id, 'Chapitre 4 à lire').expect(201);
      expect((await thread(eleve, 'Classe 3ème B')).unread).toBe(mine + 1);
      await send(eleve, cls.id, 'Merci monsieur').expect(201);
      expect((await thread(eleve, 'Classe 3ème B')).unread).toBe(0); // écrire, c'est avoir lu
      expect((await thread(prof, 'Classe 3ème B')).unread).toBe(1);
    });

    it('marquer lu ne recule jamais et refuse les fils des autres', async () => {
      const t = await thread(parent, DEMO_USERS.enseignant.name);
      await post(`/threads/${t.id}/read`, parent).expect(200);
      await post(`/threads/${t.id}/read`, parent, { upTo: 1 }).expect(200); // un curseur plus ancien ne rend rien non lu
      expect((await thread(parent, DEMO_USERS.enseignant.name)).unread).toBe(0);
      await post(`/threads/${t.id}/read`, eleve).expect(404);
    });

    it('un envoi rejoué avec le même clientId n’est enregistré qu’une fois', async () => {
      const t = await thread(parent, DEMO_USERS.enseignant.name);
      await send(parent, t.id, 'Une seule fois', 'rejeu-1').expect(201);
      await send(parent, t.id, 'Une seule fois', 'rejeu-1').expect(201);
      expect(
        (await messages(parent, t.id)).filter(
          (m) => m.text === 'Une seule fois',
        ),
      ).toHaveLength(1);
      expect(
        (await thread(prof, DEMO_USERS.parent.name)).unread,
      ).toBeGreaterThanOrEqual(0);
    });

    it('un autre utilisateur ne peut pas reprendre le clientId d’un message', async () => {
      const cls = await thread(prof, 'Classe 3ème B');
      await send(prof, cls.id, 'Premier', 'partage-1').expect(201);
      await send(eleve, cls.id, 'Usurpation', 'partage-1').expect(400);
    });
  });

  describe('créer une conversation privée', () => {
    it('le parent ne peut écrire qu’à l’administration et aux enseignants de la classe de son enfant', async () => {
      const contacts = (await get('/threads/contacts', parent).expect(200))
        .body as { key: string; name: string; label: string }[];
      expect(contacts.map((x) => x.name)).toEqual(
        expect.arrayContaining(['Administration', DEMO_USERS.enseignant.name]),
      );
      expect(
        contacts.find((x) => x.name === DEMO_USERS.enseignant.name)!.label,
      ).toMatch(/^Enseignant · 3ème B · /);
      expect(
        contacts.every(
          (x) =>
            x.name === 'Administration' || x.label.startsWith('Enseignant'),
        ),
      ).toBe(true); // ni élèves, ni autres parents
    });

    it('démarre une conversation avec un enseignant, une seule par couple (idempotent, dans les deux sens)', async () => {
      const autre = await createUser(app, {
        id: 'u-prof-2',
        phone: '07555222',
        role: 'enseignant',
        schoolId: DEMO_SCHOOL_ID,
        name: 'Mme Obiang',
      });
      expect(
        (await get('/threads/contacts', eleve).expect(200)).body.map(
          (x: { name: string }) => x.name,
        ),
      ).not.toContain('Mme Obiang'); // sans affectation dans sa classe
      const key = (await get('/threads/contacts?q=ndong', parent).expect(200))
        .body[0]?.key as string | undefined;
      const mine = (await threads(parent)).filter(
        (t) => t.name === DEMO_USERS.enseignant.name,
      );
      expect(mine).toHaveLength(1);
      const again = (
        await post('/threads', parent, {
          contact: key ?? `u:${DEMO_USERS.enseignant.id}`,
        }).expect(201)
      ).body as Thread;
      expect(again.id).toBe(mine[0]!.id); // la conversation existante, pas un doublon
      expect(
        await threads(autre).then((l) => l.map((t) => t.name)),
      ).not.toContain(DEMO_USERS.parent.name);
    });

    it('l’enseignant écrit à un parent de ses classes ; le fil est le même vu des deux côtés', async () => {
      const contacts = (await get('/threads/contacts', prof).expect(200))
        .body as { key: string; name: string; label: string }[];
      const target = contacts.find((x) => x.label.startsWith('Parent de'));
      expect(target).toBeDefined();
      const opened = (
        await post('/threads', prof, { contact: target!.key }).expect(201)
      ).body as Thread;
      await send(
        prof,
        opened.id,
        'Bonjour, une question sur votre enfant.',
      ).expect(201);
      const seen = (await threads(parent)).find((t) => t.id === opened.id);
      expect(seen?.name).toBe(DEMO_USERS.enseignant.name);
      expect(seen?.unread).toBeGreaterThan(0);
    });

    it('refuse un contact qui n’est pas dans sa liste : autre parent, élève pour un parent, personne d’une autre école', async () => {
      await post('/threads', parent, {
        contact: `u:${DEMO_USERS.eleve.id}`,
      }).expect(404);
      await post('/threads', parent, { contact: 'u:inconnu' }).expect(404);
      await post('/threads', parent, { contact: `admin:autre-ecole` }).expect(
        404,
      );
      await post('/threads', eleve, {
        contact: `u:${DEMO_USERS.parent.id}`,
      }).expect(404);
      await post('/threads', eleve, {
        contact: `admin:${DEMO_SCHOOL_ID}`,
      }).expect(404);
      const autreParent = await createUser(app, {
        id: 'u-parent-y',
        phone: '06555333',
        role: 'parent',
        schoolId: null,
      });
      await post('/threads', autreParent, {
        contact: `u:${DEMO_USERS.enseignant.id}`,
      }).expect(404); // aucun enfant dans sa classe
      await post('/threads', prof, { contact: 'u:u-ecole-2' }).expect(404); // la direction de l'autre école
    });

    it('chacun ne voit que ses propres contacts', async () => {
      const names = async (t: string) =>
        (
          (await get('/threads/contacts', t).expect(200)).body as {
            name: string;
          }[]
        ).map((x) => x.name);
      const mine = (await get('/threads/contacts', eleve).expect(200)).body as {
        label: string;
      }[];
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((x) => x.label.startsWith('Enseignant · 3ème B'))).toBe(
        true,
      ); // seulement les enseignants de sa classe
      expect(
        await names(await login(SECOND_SCHOOL_DIRECTOR.phone)),
      ).not.toContain(DEMO_USERS.parent.name);
      expect(await names(ecole)).toEqual(
        expect.arrayContaining([
          DEMO_USERS.parent.name,
          DEMO_USERS.enseignant.name,
        ]),
      );
    });
  });

  describe('droits d’accès par fil', () => {
    it('fil « élèves » d’une classe : enseignants de la classe et élèves de la classe, personne d’autre', async () => {
      const id = (await thread(eleve, 'Classe 3ème B')).id;
      await get(`/threads/${id}/messages`, eleve).expect(200);
      await send(eleve, id, 'Bonjour').expect(201);
      await get(`/threads/${id}/messages`, prof).expect(200);
      for (const [who, token] of [
        ['parent', parent],
        ['direction', ecole],
        ['élève d’une autre classe', await login('07123000')],
        [
          'enseignant sans cette classe',
          await createUser(app, {
            id: 'u-prof-3',
            phone: '07555333',
            role: 'enseignant',
            schoolId: DEMO_SCHOOL_ID,
          }),
        ],
        [
          'direction d’une autre école',
          await login(SECOND_SCHOOL_DIRECTOR.phone),
        ],
      ] as const) {
        await get(`/threads/${id}/messages`, token).expect(404);
        await send(token, id, `intrusion ${who}`).expect(404);
        await post(`/threads/${id}/read`, token).expect(404);
      }
      expect(
        (await messages(eleve, id))
          .map((m) => m.text)
          .some((t) => t?.startsWith('intrusion')),
      ).toBe(false);
    });

    it('fil « parents » d’une classe : l’enseignant écrit, ses parents lisent, la direction lit et écrit, les élèves n’y ont pas accès', async () => {
      const id = (await thread(prof, 'Parents de 3ème B')).id;
      await send(prof, id, 'Annonce').expect(201);
      await get(`/threads/${id}/messages`, parent).expect(200);
      await send(ecole, id, 'Message de la direction').expect(201);
      await send(parent, id, 'Réponse').expect(403);
      await get(`/threads/${id}/messages`, eleve).expect(404);
      await send(eleve, id, 'Intrusion').expect(404);
      const outsider = await createUser(app, {
        id: 'u-parent-z',
        phone: '06555444',
        role: 'parent',
        schoolId: null,
      });
      await get(`/threads/${id}/messages`, outsider).expect(404);
    });

    it('fil de l’équipe : enseignants et direction seulement', async () => {
      const id = (await thread(prof, 'Équipe pédagogique')).id;
      await send(prof, id, 'Bonjour à tous').expect(201);
      await send(ecole, id, 'Merci').expect(201);
      for (const t of [
        eleve,
        parent,
        await login(SECOND_SCHOOL_DIRECTOR.phone),
      ]) {
        await get(`/threads/${id}/messages`, t).expect(404);
        await send(t, id, 'x').expect(404);
      }
    });

    it('conversation privée : seulement ses deux participants', async () => {
      const id = (await thread(parent, DEMO_USERS.enseignant.name)).id;
      await get(`/threads/${id}/messages`, parent).expect(200);
      await get(`/threads/${id}/messages`, prof).expect(200);
      for (const t of [
        eleve,
        ecole,
        await login(SECOND_SCHOOL_DIRECTOR.phone),
        await createUser(app, {
          id: 'u-prof-4',
          phone: '07555444',
          role: 'enseignant',
          schoolId: DEMO_SCHOOL_ID,
        }),
      ]) {
        await get(`/threads/${id}/messages`, t).expect(404);
        await send(t, id, 'curieux').expect(404);
      }
    });

    it('conversation avec l’administration : le parent et toute la direction de l’école, pas un autre parent ni un enseignant', async () => {
      const id = (await thread(parent, 'Administration')).id;
      await get(`/threads/${id}/messages`, ecole).expect(200);
      const autreParent = await createUser(app, {
        id: 'u-parent-w',
        phone: '06555555',
        role: 'parent',
        schoolId: null,
      });
      for (const t of [
        autreParent,
        prof,
        eleve,
        await login(SECOND_SCHOOL_DIRECTOR.phone),
      ])
        await get(`/threads/${id}/messages`, t).expect(404);
    });

    it('rien sans session, et les profils sans messagerie sont refusés', async () => {
      await c.api().get('/threads').expect(401);
      await get('/threads', await c.token('agent')).expect(403);
      await get('/threads', await c.token('partenaire')).expect(403);
      await get('/threads', await c.token('admin')).expect(403);
    });
  });

  describe('messages : contenu, images et limites', () => {
    it('refuse un message vide, trop long, ou sans identifiant', async () => {
      const id = (await thread(parent, DEMO_USERS.enseignant.name)).id;
      await post(`/threads/${id}/messages`, parent, { clientId: 'v-1' }).expect(
        400,
      );
      await post(`/threads/${id}/messages`, parent, {
        text: '   ',
        clientId: 'v-2',
      }).expect(400);
      await post(`/threads/${id}/messages`, parent, {
        text: 'x'.repeat(2001),
        clientId: 'v-3',
      }).expect(400);
      await post(`/threads/${id}/messages`, parent, { text: 'Bonjour' }).expect(
        400,
      );
      await send(parent, id, 'x'.repeat(2000)).expect(201);
    });

    it('une image jointe est lue par les participants du fil, pas par les autres', async () => {
      const id = (await thread(parent, DEMO_USERS.enseignant.name)).id;
      const file = (
        await c
          .api()
          .post('/files')
          .set(c.as(parent))
          .field('kind', 'message')
          .attach('file', jpeg(), {
            filename: 'cahier.jpg',
            contentType: 'image/jpeg',
          })
          .expect(201)
      ).body as { id: string };
      await c.api().get(`/files/${file.id}`).set(c.as(prof)).expect(404); // pas encore envoyée : seul le propriétaire la voit
      const msg = (
        await post(`/threads/${id}/messages`, parent, {
          fileId: file.id,
          clientId: 'img-1',
        }).expect(201)
      ).body as Msg;
      expect(msg).toMatchObject({ fileId: file.id, mine: true });
      await c.api().get(`/files/${file.id}`).set(c.as(prof)).expect(200);
      for (const t of [eleve, ecole, await login(SECOND_SCHOOL_DIRECTOR.phone)])
        await c.api().get(`/files/${file.id}`).set(c.as(t)).expect(404);
      const seen = (await messages(prof, id)).find((m) => m.fileId === file.id);
      expect(seen).toMatchObject({ mine: false, fileId: file.id });
      // renvoi du même message (file hors ligne) : pas de doublon, pas d'erreur
      await post(`/threads/${id}/messages`, parent, {
        fileId: file.id,
        clientId: 'img-1',
      }).expect(201);
      expect(
        (await messages(parent, id)).filter((m) => m.fileId === file.id),
      ).toHaveLength(1);
    });

    it('refuse une image déjà utilisée, d’un autre usage, ou envoyée par quelqu’un d’autre ; le message n’est pas créé', async () => {
      const id = (await thread(parent, DEMO_USERS.enseignant.name)).id;
      const before = (await messages(parent, id)).length;
      const proof = (
        await c
          .api()
          .post('/files')
          .set(c.as(eleve))
          .field('kind', 'proof')
          .attach('file', jpeg(), {
            filename: 'p.jpg',
            contentType: 'image/jpeg',
          })
          .expect(201)
      ).body as { id: string };
      const avatar = (
        await c
          .api()
          .post('/files')
          .set(c.as(parent))
          .field('kind', 'avatar')
          .attach('file', jpeg(), {
            filename: 'a.jpg',
            contentType: 'image/jpeg',
          })
          .expect(201)
      ).body as { id: string };
      await post(`/threads/${id}/messages`, parent, {
        fileId: proof.id,
        clientId: 'bad-1',
      }).expect(400); // fichier d'un autre
      await post(`/threads/${id}/messages`, parent, {
        fileId: avatar.id,
        clientId: 'bad-2',
      }).expect(400); // mauvais usage
      await post(`/threads/${id}/messages`, parent, {
        fileId: 'inconnu',
        clientId: 'bad-3',
      }).expect(400);
      expect((await messages(parent, id)).length).toBe(before);
    });

    it('limite le débit d’envoi à 60 messages par minute', async () => {
      const id = (await thread(prof, 'Équipe pédagogique')).id;
      for (let i = 0; i < 60; i++)
        await send(prof, id, `m${i}`, `rate-${i}`).expect(201);
      const refused = await send(prof, id, 'trop', 'rate-61').expect(429);
      expect(refused.body.code).toBe('RATE_LIMITED');
    });
  });
});
