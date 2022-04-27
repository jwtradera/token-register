use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;
use anchor_spl::token::{self, TokenAccount, Mint, Token};
use std::io::Write;

declare_id!("4DHXD1JVCTYQnWVXpqG1HY9LbAocbsfQUbDqmK4qBB4o");

#[program]
pub mod token_register {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> ProgramResult {
        let manager_account = &mut ctx.accounts.manager_account;
        manager_account.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn update_manager(ctx: Context<UpdateManager>, bump: u8, new_manager: Pubkey) -> ProgramResult {
        let manager_account = &mut ctx.accounts.manager_account;
        manager_account.authority = new_manager;
        Ok(())
    }

    pub fn register(ctx: Context<Register>, manager_bump: u8, authority_bump: u8,
        name: String, symbol: String, image_uri: String) -> Result<()> {

        let authority = ctx.accounts.authority.key();
        let mint_authority = ctx.accounts.mint.mint_authority.unwrap();

        if ctx.accounts.manager_account.authority.key() != authority
            && mint_authority != authority {
            require!(false, CustomError::InvalidRegisterRights)
        }

        let token_account = &mut ctx.accounts.token_account;
        token_account.address = ctx.accounts.mint.key();

        token_account.name = name;
        token_account.symbol = symbol;
        token_account.image_uri = image_uri;

        Ok(())
    }

    pub fn update_token(ctx: Context<UpdateToken>, manager_bump: u8, authority_bump: u8,
        name: String, symbol: String, image_uri: String) -> Result<()> {

        msg!("{} {} {}", name, symbol, image_uri);

        let authority = ctx.accounts.authority.key();
        let mint_authority = ctx.accounts.mint.mint_authority.unwrap();

        if ctx.accounts.manager_account.authority.key() != authority
            && mint_authority != authority {
            require!(false, CustomError::InvalidEditRights)
        }

        let token_account = &mut ctx.accounts.token_account;
        token_account.name = name;
        token_account.symbol = symbol;
        token_account.image_uri = image_uri;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {

    #[account(
        init,
        payer = authority,
        seeds = [b"manager"],
        bump,
        space = 8 + Manager::LEN
    )]
    pub manager_account: Box<Account<'info, Manager>>,

    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct UpdateManager<'info> {

    #[account(
        mut,
        seeds = [b"manager"],
        bump = bump,
        constraint = manager_account.authority.key() == authority.key()
    )]
    pub manager_account: Box<Account<'info, Manager>>,

    #[account(mut)]
    pub authority: Signer<'info>
}

#[derive(Accounts)]
#[instruction(manager_bump: u8, authority_bump: u8)]
pub struct Register<'info> {

    #[account(
        seeds = [b"manager"],
        bump = manager_bump
    )]
    pub manager_account: Box<Account<'info, Manager>>,

    #[account(
        init,
        payer = authority,
        seeds = [b"token", mint.key().as_ref()],
        bump,
        space = 8 + 1000
    )]
    pub token_account: Box<Account<'info, TokenInfo>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(manager_bump: u8, authority_bump: u8)]
pub struct UpdateToken<'info> {

    #[account(
        seeds = [b"manager"],
        bump = manager_bump
    )]
    pub manager_account: Box<Account<'info, Manager>>,

    #[account(
        mut,
        seeds = [b"token", mint.key().as_ref()],
        bump = authority_bump
    )]
    pub token_account: Box<Account<'info, TokenInfo>>,

    #[account()]
    pub authority: Signer<'info>,

    pub mint: Account<'info, Mint>
}


#[account]
pub struct Manager {
    pub authority: Pubkey
}
impl Manager {
    pub const LEN: usize = 
        32;
}

#[repr(C)]
#[account]
pub struct TokenInfo {
    pub address: Pubkey,
    pub name: String,
    pub symbol: String,
    pub image_uri: String,
}


#[error_code]
pub enum CustomError {
    #[msg("You don't have rights for register.")]
    InvalidRegisterRights,

    #[msg("You don't have rights for edit.")]
    InvalidEditRights,
}