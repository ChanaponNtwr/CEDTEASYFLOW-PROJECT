// src/service/user/classuser.js
const prisma = require('../../lib/prisma').default || require('../../lib/prisma');

class ClassUser {
  constructor(prismaClient) {
    this.prisma = prismaClient;
  }

  // หา user จาก email
  async getUserByEmail(email) {
    if (!email) return null;
    return this.prisma.user.findUnique({ where: { email } });
  }

  // สร้าง user ใหม่ (ยังเก็บไว้ในกรณีที่ต้องการเรียกตรงๆ)
  async createUser({ email, name, image = null }) {
    const fname = name ? name.split(' ')[0] : '';
    const lname = name ? (name.split(' ')[1] ?? '') : '';
    return this.prisma.user.create({
      data: {
        email,
        name: name ?? 'Unknown',
        fname,
        lname,
        image,
      },
    });
  }

  // อัพเดต user โดยใช้ email เป็น key (ยังเก็บไว้)
  async updateUserByEmail(email, { name, image = null }) {
    const fname = name ? name.split(' ')[0] : '';
    const lname = name ? (name.split(' ')[1] ?? '') : '';
    return this.prisma.user.update({
      where: { email },
      data: {
        name: name ?? 'Unknown',
        fname,
        lname,
        image,
      },
    });
  }

  // หา account ตาม provider + providerAccountId
  async findAccountByProvider(provider, providerAccountId) {
    if (!provider || !providerAccountId) return null;
    return this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: providerAccountId.toString(),
        },
      },
    });
  }

  // สร้าง account (เชื่อมกับ userId)
  async createAccount({ userId, provider, providerAccountId, type = 'oauth', access_token = '' }) {
    return this.prisma.account.create({
      data: {
        userId,
        provider,
        providerAccountId: providerAccountId.toString(),
        type,
        access_token,
      },
    });
  }

  /**
   * หา user ถ้าไม่มีให้สร้าง แล้วเช็ค/สร้าง account ให้ด้วย
   * ใช้ upsert + transaction เพื่อความ atomic และลด race condition
   *
   * oauthUser: { id, email, name, image, accessToken }
   * provider: string (เช่น 'google')
   */
  async ensureUserAndAccount(oauthUser, provider = 'google') {
    if (!oauthUser || !oauthUser.email) {
      throw new Error('Missing email in oauth user');
    }

    const providerStr = provider ?? 'google';
    const providerAccountId = oauthUser.id?.toString();
    const imageUrl = oauthUser.image ?? null;

    // transaction เพื่อให้การ upsert user และการสร้าง account เป็น atomic
    return await this.prisma.$transaction(async (tx) => {
      // upsert user: สร้างใหม่ถ้ายังไม่มี หรืออัพเดตกรณีมีอยู่แล้ว (รวม image)
      const dbUser = await tx.user.upsert({
        where: { email: oauthUser.email },
        update: {
          name: oauthUser.name ?? undefined,
          fname: oauthUser.name ? oauthUser.name.split(' ')[0] : undefined,
          lname: oauthUser.name ? (oauthUser.name.split(' ')[1] ?? '') : undefined,
          // ถ้า imageUrl เป็น null/undefined จะไม่เปลี่ยนค่าเดิม (undefined = ไม่อัพเดต)
          image: imageUrl ?? undefined,
        },
        create: {
          email: oauthUser.email,
          name: oauthUser.name ?? 'Unknown',
          fname: oauthUser.name ? oauthUser.name.split(' ')[0] : '',
          lname: oauthUser.name ? (oauthUser.name.split(' ')[1] ?? '') : '',
          image: imageUrl ?? null,
        },
      });

      // หา account ด้วย composite unique key (provider + providerAccountId)
      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: providerStr,
            providerAccountId: providerAccountId,
          },
        },
      });

      if (!existingAccount) {
        await tx.account.create({
          data: {
            userId: dbUser.id,
            provider: providerStr,
            providerAccountId: providerAccountId,
            type: 'oauth',
            access_token: oauthUser.accessToken ?? '',
          },
        });
      } else {
        // ถ้าต้องการอัพเดต access_token เมื่อมันเปลี่ยน ให้ทำที่นี่ (option)
        // await tx.account.update({
        //   where: { id: existingAccount.id },
        //   data: { access_token: oauthUser.accessToken ?? existingAccount.access_token },
        // });
      }

      return dbUser;
    });
  }
}

module.exports = new ClassUser(prisma);
