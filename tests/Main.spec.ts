import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { Main } from '../wrappers/Main';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('Main', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('Main');
    });


    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let main: SandboxContract<Main>;
    let receiver: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;


    beforeEach(async () => {
        blockchain = await Blockchain.create();
        receiver = await blockchain.treasury('receiver');
        admin = await blockchain.treasury('admin');
        user = await blockchain.treasury('user');

        main = blockchain.openContract(Main.createFromConfig({
            receiver: receiver.address,
            admin: admin.address
        }, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await main.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: main.address,
            deploy: true,
            success: true,
        });
    });

    it('should accept funds', async () => {
        const userBalanceBefore = await user.getBalance();

        const sendFundsResult = await main.sendFunds(user.getSender(), toNano('3'))
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: true,
        });
        const userBalanceAfter = await user.getBalance();
        expect(userBalanceAfter).toBeLessThan(userBalanceBefore);
    });

    it('should not accept small funds', async () => {
        const sendFundsResult = await main.sendFunds(user.getSender(), toNano('1'))
        expect(sendFundsResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: false,
            exitCode: 98
        });
    })

    it('should withdraw to admin', async() => {
        const sendWithdrawalResult = await main.sendWithdrawal(admin.getSender())
        expect(sendWithdrawalResult.transactions).toHaveTransaction({
            from: admin.address,
            to: main.address,
            success: true,
            outMessagesCount: 1,
            op: 0x6d2d3b45
        });
    })

    it('should not withdraw to user', async() => {
        const sendWithdrawalResult = await main.sendWithdrawal(user.getSender())
        expect(sendWithdrawalResult.transactions).toHaveTransaction({
            from: user.address,
            to: main.address,
            success: false,
            exitCode: 99
        });
    })
});
