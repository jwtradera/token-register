import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from 'chai';

import { TokenRegister } from "../target/types/token_register";

describe("token-register", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenRegister as Program<TokenRegister>;

  const manager = anchor.web3.Keypair.generate(); // Manager
  const updated_manager = anchor.web3.Keypair.generate(); // Updated manager
  const spl_manager = anchor.web3.Keypair.generate(); // SPL token authority
  let mint: Token = null; // SPL token mint

  let pdaManager = null;
  let pdaManagerBump = null;


  it("Initialize for test state", async () => {
    // Airdrop for users

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(manager.publicKey, anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(updated_manager.publicKey, anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(spl_manager.publicKey, anchor.web3.LAMPORTS_PER_SOL),
      "confirmed"
    );

    // Create spl token
    mint = await Token.createMint(
      provider.connection,
      spl_manager,
      spl_manager.publicKey,
      null,
      0,
      TOKEN_PROGRAM_ID
    );

    [pdaManager, pdaManagerBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("manager")], program.programId);

  });

  it("Is initialized!", async () => {
    // Call initialize
    const tx = await provider.connection.confirmTransaction(
      await program.rpc.initialize(
        pdaManagerBump, {
        accounts: {
          managerAccount: pdaManager,
          authority: manager.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        },
        signers: [manager]
      })
    );

    // Check current manager
    const info = await program.account.manager.fetch(pdaManager);
    assert.equal(info.authority.toString(), manager.publicKey.toString());
  });

  it("Update manager", async () => {
    const tx = await provider.connection.confirmTransaction(
      await program.rpc.updateManager(
        pdaManagerBump,
        updated_manager.publicKey,
        {
          accounts: {
            managerAccount: pdaManager,
            authority: manager.publicKey,
          },
          signers: [manager]
        })
    );

    // Check updated manager
    const info = await program.account.manager.fetch(pdaManager);
    assert.equal(info.authority.toString(), updated_manager.publicKey.toString());
  });

  it("Register token", async () => {

    const [pdaToken, pdaTokenBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("token"), mint.publicKey.toBytes()], program.programId);

    // Call register with manager
    const tx = await provider.connection.confirmTransaction(
      await program.rpc.register(
        pdaManagerBump,
        pdaTokenBump,
        "Test Token 1",
        "TKN",
        "https://test.com",
        {
          accounts: {
            managerAccount: pdaManager,
            tokenAccount: pdaToken,
            authority: updated_manager.publicKey,
            mint: mint.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          },
          signers: [updated_manager]
        })
    );

    // Check registered token
    const tokenInfo = await program.account.tokenInfo.fetch(pdaToken);
    assert.equal(tokenInfo.address.toString(), mint.publicKey.toString());
  });

  it("Update token", async () => {

    const [pdaToken, pdaTokenBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("token"), mint.publicKey.toBytes()], program.programId);

    // Call update with token authority
    const tx = await provider.connection.confirmTransaction(
      await program.rpc.updateToken(
        pdaManagerBump,
        pdaTokenBump,
        "Test Token 2",
        "TKN2",
        "https://test.com2",
        {
          accounts: {
            managerAccount: pdaManager,
            tokenAccount: pdaToken,
            authority: spl_manager.publicKey,
            mint: mint.publicKey
          },
          signers: [spl_manager]
        })
    );

    // Check updated token
    const tokenInfo = await program.account.tokenInfo.fetch(pdaToken, "single");
    console.log(tokenInfo.name);
    console.log(tokenInfo.symbol);
    console.log(tokenInfo.imageUri);
  });

  it("Check authority", async () => {

    const [pdaToken, pdaTokenBump] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("token"), mint.publicKey.toBytes()], program.programId);

    // Call update manager with wrong authority
    try {
      const tx = await provider.connection.confirmTransaction(
        await program.rpc.updateManager(
          pdaManagerBump,
          updated_manager.publicKey,
          {
            accounts: {
              managerAccount: pdaManager,
              authority: manager.publicKey,
            },
            signers: [manager]
          })
      );
    }
    catch (ex) {
      console.log(ex.error);
    }

    // Call update token with wrong authority
    try {
      const tx = await provider.connection.confirmTransaction(
        await program.rpc.updateToken(
          pdaManagerBump,
          pdaTokenBump,
          "Test Token 2",
          "TKN2",
          "https://test.com2",
          {
            accounts: {
              managerAccount: pdaManager,
              tokenAccount: pdaToken,
              authority: manager.publicKey,
              mint: mint.publicKey
            },
            signers: [manager]
          })
      );
    }
    catch (ex) {
      console.log(ex.error);
    }
  });

});
