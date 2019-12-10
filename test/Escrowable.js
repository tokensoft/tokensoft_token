/* global artifacts contract it assert */
const BN = require('bn.js')
const ArcaTokenEscrow = artifacts.require('ArcaTokenEscrow')
const Proxy = artifacts.require('Proxy')
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')

const ProposalState = { Pending: '0', Approved: '1', Rejected: '2', Canceled: '3' }
const FAILURE_BALANCE_INVALID_MESSAGE = 'ERC20: transfer amount exceeds balance -- Reason given: ERC20: transfer amount exceeds balance.'
const FAILURE_ALLOWANCE_BALANCE_INVALID_MESSAGE = 'ERC20: transfer amount exceeds allowance -- Reason given: ERC20: transfer amount exceeds allowance.'
const NON_ADMIN_ERROR = 'AdminRole: caller does not have the Admin role -- Reason given: AdminRole: caller does not have the Admin role.'
const NOT_VALID_ACCEPT = 'Request must be in Pending state to approve.'
const NOT_VALID_REJECT = 'Request must be in Pending state to reject.'
const NOT_VALID_CANCEL = 'Request must be in Pending state to cancel.'
const NOT_VALID_CREATOR = 'Only the creator of a request can cancel it'
const NOT_VALID_RANGE = 'Request ID is not in proper range'

contract('Escrowable', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await ArcaTokenEscrow.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await ArcaTokenEscrow.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })
  it('should create allow simple transferFrom proposal flow', async () => {
    await tokenInstance.addAdmin(accounts[0])
    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Approve account 1 to transfer
    await tokenInstance.approve(accounts[1], 100000)

    // Start a transferFrom using account 1
    await tokenInstance.transferFrom(accounts[0], accounts[2], 100000, { from: accounts[1] })

    // Users balance should show the amount debited
    const beforeAfterProposal = await tokenInstance.balanceOf(accounts[0])
    assert.equal(beforeBalance.sub(new BN(100000)).toString(), beforeAfterProposal.toString(), 'Balance not change')

    // Have the owner approve the proposal
    await tokenInstance.approveTransferProposal(0)

    // Funds should be transferred
    const beforeAfterTransfer = await tokenInstance.balanceOf(accounts[0])
    assert.equal(beforeAfterTransfer.toString(), beforeBalance.sub(new BN(100000)).toString(), 'Balance should not change')

    // Funds should be transferred
    const targetBalance = await tokenInstance.balanceOf(accounts[2])
    assert.equal(targetBalance.toString(), '100000', 'Balance should update')
  })

  it('should allow simple proposal transferFrom rejection', async () => {
    await tokenInstance.addAdmin(accounts[0])

    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Approve account 1 to transfer
    await tokenInstance.approve(accounts[1], 10)

    // Start a transferFrom using account 1
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })

    // Have the owner reject the proposal
    await tokenInstance.rejectTransferProposal(0)

    // Funds should not be transferred
    const afterRejection = await tokenInstance.balanceOf(accounts[0])
    assert.equal(afterRejection.toString(), beforeBalance.toString(), 'Balance should not change')
  })

  it('should allow simple transferFrom proposal cancel', async () => {
    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Approve account 1 to transfer
    await tokenInstance.approve(accounts[1], 10)

    // Start a transferFrom using account 1
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })

    // Have the owner reject the proposal
    await tokenInstance.cancelTransferProposal(0, { from: accounts[1] })

    // Funds should not be transferred
    const afterCancel = await tokenInstance.balanceOf(accounts[0])
    assert.equal(afterCancel.toString(), beforeBalance.toString(), 'Balance should not change')
  })

  it('should validate creating a proposal', async () => {
    await tokenInstance.addAdmin(accounts[0])
    await tokenInstance.addAdmin(accounts[5])
    // Account with 0 balance should fail
    await tokenInstance.approve(accounts[1], 100000, { from: accounts[2] })
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[3], 100000, { from: accounts[1] }), FAILURE_BALANCE_INVALID_MESSAGE)

    // Account without approval should fail
    await expectRevert(tokenInstance.transferFrom(accounts[0], accounts[3], 100000, { from: accounts[1] }), FAILURE_ALLOWANCE_BALANCE_INVALID_MESSAGE)

    // Approve account 1 to transfer from account 0
    await tokenInstance.approve(accounts[1], 10)

    // Start a transferFrom using account 1 to send from 0 to 2
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.approveTransferProposal(0)

    // One above the balance should fail
    await tokenInstance.approve(accounts[5], 10, { from: accounts[2] })
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[4], 11, { from: accounts[5] }), FAILURE_BALANCE_INVALID_MESSAGE)

    // First one should pass and second one should fail since all tokens are locked in proposals
    await tokenInstance.transferFrom(accounts[2], accounts[6], 10, { from: accounts[5] })
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[6], 10, { from: accounts[5] }), FAILURE_BALANCE_INVALID_MESSAGE)

    // Cancel it
    await tokenInstance.cancelTransferProposal(1, { from: accounts[5] })

    // Approve 10 more
    await tokenInstance.approve(accounts[5], 10, { from: accounts[2] })

    // Check boundaries
    await tokenInstance.transferFrom(accounts[2], accounts[6], 9, { from: accounts[5] })
    await tokenInstance.transferFrom(accounts[2], accounts[6], 1, { from: accounts[5] })

    // Add another approval for 20 more and check other boundaries
    await tokenInstance.approve(accounts[5], 20, { from: accounts[2] })
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[6], 1, { from: accounts[5] }), FAILURE_BALANCE_INVALID_MESSAGE)
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[6], 11, { from: accounts[5] }), FAILURE_BALANCE_INVALID_MESSAGE)
  })

  it('should validate accepting a tranferFrom proposal', async () => {
    await tokenInstance.addAdmin(accounts[0])
    await tokenInstance.addAdmin(accounts[1])
    // Invalid ID should fail
    await expectRevert(tokenInstance.approveTransferProposal(100), NOT_VALID_RANGE)

    // Approve account 1 to transfer
    await tokenInstance.approve(accounts[1], 10)

    // Start a transferFrom using account 1
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })

    // A non-admin should not be able to approve
    await expectRevert(tokenInstance.approveTransferProposal(0, { from: accounts[3] }), NON_ADMIN_ERROR)

    // Make account 3 an admin
    await tokenInstance.addAdmin(accounts[3], { from: accounts[0] })

    // Should pass now
    await tokenInstance.approveTransferProposal(0, { from: accounts[3] })

    // Start another proposal and then cancel it - once canceled approval should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.cancelTransferProposal(1, { from: accounts[1] })
    await expectRevert(tokenInstance.approveTransferProposal(1, { from: accounts[3] }), NOT_VALID_ACCEPT)

    // Start another proposal and then reject it - once rejected approval should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.rejectTransferProposal(2)
    await expectRevert(tokenInstance.approveTransferProposal(2, { from: accounts[3] }), NOT_VALID_ACCEPT)

    // Start another proposal and then accept it - once accepted, another approval should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.approveTransferProposal(3)
    await expectRevert(tokenInstance.approveTransferProposal(3, { from: accounts[3] }), NOT_VALID_ACCEPT)
  })

  it('should validate rejecting a proposal', async () => {
    await tokenInstance.addAdmin(accounts[0])
    // Invalid ID should fail
    await expectRevert(tokenInstance.rejectTransferProposal(100), NOT_VALID_RANGE)

    // Approve account 1 to transfer
    await tokenInstance.approve(accounts[1], 10)

    // Start a transferFrom using account 1
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })

    // A non-admin should not be able to reject
    await expectRevert(tokenInstance.rejectTransferProposal(0, { from: accounts[3] }), NON_ADMIN_ERROR)

    // Make account 3 an admin
    await tokenInstance.addAdmin(accounts[3], { from: accounts[0] })

    // Should pass now
    await tokenInstance.rejectTransferProposal(0, { from: accounts[3] })

    // Start another proposal and then cancel it - once canceled approval should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.cancelTransferProposal(1, { from: accounts[1] })
    await expectRevert(tokenInstance.rejectTransferProposal(1, { from: accounts[3] }), NOT_VALID_REJECT)

    // Start another proposal and then accept it - once accepted, rejection should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.approveTransferProposal(2)
    await expectRevert(tokenInstance.rejectTransferProposal(2, { from: accounts[3] }), NOT_VALID_REJECT)

    // Start another proposal and then reject it - once rejected, another reject should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.rejectTransferProposal(3)
    await expectRevert(tokenInstance.rejectTransferProposal(3, { from: accounts[3] }), NOT_VALID_REJECT)
  })

  it('should validate canceling a proposal', async () => {
    await tokenInstance.addAdmin(accounts[0])
    await tokenInstance.addAdmin(accounts[1])
    // Invalid ID should fail
    await expectRevert(tokenInstance.cancelTransferProposal(100), NOT_VALID_RANGE)

    // Move tokens to account 2
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })

    // A different account and the from acct should not be able to reject
    await expectRevert(tokenInstance.cancelTransferProposal(0), NOT_VALID_CREATOR)
    await expectRevert(tokenInstance.cancelTransferProposal(0, { from: accounts[3] }), NOT_VALID_CREATOR)

    // Should pass with original acct
    await tokenInstance.cancelTransferProposal(0, { from: accounts[1] })

    // Start another proposal and then accept it - once accepted, cancel should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.approveTransferProposal(1)
    await expectRevert(tokenInstance.cancelTransferProposal(1, { from: accounts[1] }), NOT_VALID_CANCEL)

    // Start another proposal and then reject it - once rejected cancel should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.rejectTransferProposal(2)
    await expectRevert(tokenInstance.cancelTransferProposal(1, { from: accounts[1] }), NOT_VALID_CANCEL)

    // Start another proposal and then cancel it - once canceled, another cancel should fail
    await tokenInstance.approve(accounts[1], 10)
    await tokenInstance.transferFrom(accounts[0], accounts[2], 10, { from: accounts[1] })
    await tokenInstance.cancelTransferProposal(3, { from: accounts[1] })
    await expectRevert(tokenInstance.cancelTransferProposal(3, { from: accounts[1] }), NOT_VALID_CANCEL)
  })

  it('should allow approval proposal flow for transfer logs', async () => {
    await tokenInstance.addAdmin(accounts[0])
    // Approve
    let receipt = await tokenInstance.transfer(accounts[1], 100000)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(0),
      state: ProposalState.Pending
    })

    receipt = await tokenInstance.approveTransferProposal(0)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(0),
      state: ProposalState.Approved
    })

    // Reject
    receipt = await tokenInstance.transfer(accounts[1], 100000)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(1),
      state: ProposalState.Pending
    })

    receipt = await tokenInstance.rejectTransferProposal(1)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(1),
      state: ProposalState.Rejected
    })

    // Cancel
    receipt = await tokenInstance.transfer(accounts[1], 100000)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(2),
      state: ProposalState.Pending
    })

    receipt = await tokenInstance.cancelTransferProposal(2)
    expectEvent(receipt, 'TransferProposalUpdated', {
      updatedBy: accounts[0],
      requestId: new BN(2),
      state: ProposalState.Canceled
    })
  })

  it('should allow simple transfer proposal flow', async () => {
    await tokenInstance.addAdmin(accounts[0])

    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Start a transfer
    await tokenInstance.transfer(accounts[1], 100000)

    // Users balance should be debited the amount
    const afterProposal = await tokenInstance.balanceOf(accounts[0])
    assert.equal(beforeBalance.sub(new BN(100000)).toString(), afterProposal.toString(), 'Balance should change')

    // Have the owner approve the proposal
    await tokenInstance.approveTransferProposal(0)

    // Source funds should not change
    const afterTransfer = await tokenInstance.balanceOf(accounts[0])
    assert.equal(afterTransfer.toString(), afterProposal.toString(), 'Balance should not change')

    // Target funds should change
    const targetBalance = await tokenInstance.balanceOf(accounts[1])
    assert.equal(targetBalance.toString(), '100000', 'Target balance should get updated')
  })

  it('should allow simple transfer proposal rejection', async () => {
    await tokenInstance.addAdmin(accounts[0])

    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Start a transfer
    await tokenInstance.transfer(accounts[1], 100000)

    // Have the owner reject the proposal
    await tokenInstance.rejectTransferProposal(0)

    // Funds should not be transferred
    const afterRejection = await tokenInstance.balanceOf(accounts[0])
    assert.equal(afterRejection.toString(), beforeBalance.toString(), 'Balance should not change')
  })

  it('should allow simple transfer proposal cancel', async () => {
    await tokenInstance.addAdmin(accounts[0])

    // Grab the starting token balance
    const beforeBalance = await tokenInstance.balanceOf(accounts[0])

    // Start a transfer
    await tokenInstance.transfer(accounts[1], 100000)

    // Have the creator reject the proposal
    await tokenInstance.cancelTransferProposal(0)

    // Funds should not be transferred
    const afterCancel = await tokenInstance.balanceOf(accounts[0])
    assert.equal(afterCancel.toString(), beforeBalance.toString(), 'Balance should not change')

  })

})
