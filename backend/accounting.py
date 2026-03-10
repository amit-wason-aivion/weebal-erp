from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import Voucher, VoucherEntry, Ledger, TallyGroup

class AccountingEngine:
    """
    Core engine managing backend accounting validations and calculations.
    """
    def __init__(self, db_session: Session, company_id: int):
        self.db = db_session
        self.company_id = company_id

    def validate_double_entry(self, voucher_id: int) -> bool:
        """
        Ensures that Total Debits equal Total Credits for a specific voucher.
        """
        entries = self.db.query(VoucherEntry).filter(VoucherEntry.voucher_id == voucher_id).all()
        
        total_debit = Decimal('0.0000')
        total_credit = Decimal('0.0000')

        for entry in entries:
            if entry.is_debit:
                total_debit += entry.amount
            else:
                total_credit += entry.amount

        # Tally allows zero-value vouchers sometimes, but debits must always equal credits
        if total_debit != total_credit:
            raise ValueError(f"Double entry violation for Voucher {voucher_id}: Dr {total_debit} != Cr {total_credit}")
        
        return True

    def calculate_ledger_closing_balance(self, ledger_id: int) -> dict:
        """
        Calculates the real-time closing balance for a ledger.
        Formula:
        If Ledger normally has Debit balance:
            Closing = Opening + Total Debits - Total Credits
        If Ledger normally has Credit balance:
            Closing = Opening + Total Credits - Total Debits
        """
        ledger = self.db.query(Ledger).filter(Ledger.id == ledger_id, Ledger.company_id == self.company_id).first()
        if not ledger:
            raise ValueError(f"Ledger {ledger_id} not found in this company.")

        # Aggregate Debits
        total_debits = self.db.query(func.sum(VoucherEntry.amount)).filter(
            VoucherEntry.ledger_id == ledger_id,
            VoucherEntry.is_debit == True
        ).scalar() or Decimal('0.0000')

        # Aggregate Credits
        total_credits = self.db.query(func.sum(VoucherEntry.amount)).filter(
            VoucherEntry.ledger_id == ledger_id,
            VoucherEntry.is_debit == False
        ).scalar() or Decimal('0.0000')

        opening_balance = ledger.opening_balance

        if ledger.is_debit_balance:
            closing_balance = opening_balance + total_debits - total_credits
            is_closing_debit = closing_balance >= 0
        else:
            closing_balance = opening_balance + total_credits - total_debits
            is_closing_debit = closing_balance < 0

        # Return absolute balance and indicator
        return {
            "ledger_id": ledger_id,
            "ledger_name": ledger.name,
            "closing_balance": abs(closing_balance),
            "is_debit": is_closing_debit
        }

    def generate_trial_balance(self):
        """
        Generates a flat trial balance checking if all ledgers balance to Zero.
        Total Debits (Opening + Transactions) should equal Total Credits.
        """
        ledgers = self.db.query(Ledger).filter(Ledger.company_id == self.company_id).all()
        
        trial_balance = []
        total_dr = Decimal('0.0000')
        total_cr = Decimal('0.0000')

        for ledger in ledgers:
            bal_info = self.calculate_ledger_closing_balance(ledger.id)
            trial_balance.append(bal_info)
            
            if bal_info['is_debit']:
                total_dr += bal_info['closing_balance']
            else:
                total_cr += bal_info['closing_balance']

        return {
            "ledgers": trial_balance,
            "total_debit": total_dr,
            "total_credit": total_cr,
            "is_balanced": total_dr == total_cr
        }

    def generate_hierarchical_trial_balance(self):
        """
        Generates a hierarchical trial balance (Groups containing sub-groups and ledgers).
        """
        groups = self.db.query(TallyGroup).filter(TallyGroup.company_id == self.company_id).all()
        ledgers = self.db.query(Ledger).filter(Ledger.company_id == self.company_id).all()

        ledger_bals = {}
        total_dr = Decimal('0.0000')
        total_cr = Decimal('0.0000')

        for ledger in ledgers:
            bal_info = self.calculate_ledger_closing_balance(ledger.id)
            ledger_bals[ledger.id] = bal_info
            if bal_info['is_debit']:
                total_dr += bal_info['closing_balance']
            else:
                total_cr += bal_info['closing_balance']

        def build_tree(parent_id):
            tree = []
            # Find groups with this parent_id
            for group in [g for g in groups if g.parent_id == parent_id]:
                node = {
                    "key": f"group_{group.id}",
                    "name": group.name,
                    "is_group": True,
                    "children": build_tree(group.id)
                }
                tree.append(node)
                
            # Find ledgers with this group as parent
            for ledger in [l for l in ledgers if l.group_id == parent_id]:
                bal_info = ledger_bals[ledger.id]
                node = {
                    "key": f"ledger_{ledger.id}",
                    "name": ledger.name,
                    "is_group": False,
                    "debit": bal_info['closing_balance'] if bal_info['is_debit'] else None,
                    "credit": bal_info['closing_balance'] if not bal_info['is_debit'] else None
                }
                tree.append(node)
            return tree

        # Top level groups (parent_id is None or 0 depending on setup, Tally usually has primary groups)
        # For our basic setup, let's find groups that have no parent or parent_id not in any other group id.
        group_ids = {g.id for g in groups}
        top_level_groups = [g for g in groups if g.parent_id is None or g.parent_id not in group_ids]
        
        tree = []
        for group in top_level_groups:
            node = {
                "key": f"group_{group.id}",
                "name": group.name,
                "is_group": True,
                "children": build_tree(group.id)
            }
            tree.append(node)
            
        # Add Ledgers that might not have a valid parent group for some reason
        for ledger in [l for l in ledgers if l.group_id is None or l.group_id not in group_ids]:
            bal_info = ledger_bals[ledger.id]
            node = {
                "key": f"ledger_{ledger.id}",
                "name": ledger.name,
                "is_group": False,
                "debit": bal_info['closing_balance'] if bal_info['is_debit'] else None,
                "credit": bal_info['closing_balance'] if not bal_info['is_debit'] else None
            }
            tree.append(node)

        # Calculate group totals recursively
        def calculate_group_totals(nodes):
            dr_total = Decimal('0.0000')
            cr_total = Decimal('0.0000')
            for node in nodes:
                if node['is_group']:
                    g_dr, g_cr = calculate_group_totals(node['children'])
                    node['debit'] = g_dr if g_dr > 0 else None
                    node['credit'] = g_cr if g_cr > 0 else None
                    if g_dr > g_cr:
                        node['debit'] = g_dr - g_cr
                        node['credit'] = None
                        dr_total += (g_dr - g_cr)
                    else:
                        node['credit'] = g_cr - g_dr
                        node['debit'] = None
                        cr_total += (g_cr - g_dr)
                else:
                    if node['debit']: dr_total += node['debit']
                    if node['credit']: cr_total += node['credit']
            return dr_total, cr_total
            
        calculate_group_totals(tree)

        return {
            "tree": tree,
            "total_debit": total_dr,
            "total_credit": total_cr,
            "is_balanced": total_dr == total_cr
        }

    def generate_pnl(self):
        """
        Calculates Profit & Loss Statement.
        Filters Trial Balance for Direct/Indirect Expenses and Incomes.
        In a complete ERP, groups need a 'nature' column. We map by known primary names for now.
        """
        tb = self.generate_hierarchical_trial_balance()
        
        def filter_nodes_by_names(nodes, matching_names):
            result = []
            for node in nodes:
                if node['name'] in matching_names:
                    result.append(node)
                elif node['is_group'] and node.get('children'):
                    child_matches = filter_nodes_by_names(node['children'], matching_names)
                    if child_matches:
                        new_node = dict(node)
                        new_node['children'] = child_matches
                        result.append(new_node)
            return result

        # These match standard Tally Primary Groups
        direct_expenses = filter_nodes_by_names(tb['tree'], ["Direct Expenses", "Purchase Accounts"])
        indirect_expenses = filter_nodes_by_names(tb['tree'], ["Indirect Expenses"])
        direct_incomes = filter_nodes_by_names(tb['tree'], ["Direct Incomes", "Sales Accounts"])
        indirect_incomes = filter_nodes_by_names(tb['tree'], ["Indirect Incomes"])

        # Helper to sum up top-level group balances
        def get_total(nodes, is_debit_side):
            total = Decimal('0.0000')
            for node in nodes:
               val = node.get('debit') if is_debit_side else node.get('credit')
               if val: total += val
            return total
            
        total_direct_exp = get_total(direct_expenses, True)
        total_indirect_exp = get_total(indirect_expenses, True)
        total_direct_inc = get_total(direct_incomes, False)
        total_indirect_inc = get_total(indirect_incomes, False)
        
        gross_profit = total_direct_inc - total_direct_exp
        net_profit = gross_profit + total_indirect_inc - total_indirect_exp

        return {
            "trading_account": {
                "direct_expenses": direct_expenses,
                "direct_incomes": direct_incomes,
                "total_direct_exp": total_direct_exp,
                "total_direct_inc": total_direct_inc,
                "gross_profit": gross_profit
            },
            "pnl_account": {
                "indirect_expenses": indirect_expenses,
                "indirect_incomes": indirect_incomes,
                "total_indirect_exp": total_indirect_exp,
                "total_indirect_inc": total_indirect_inc,
                "net_profit": net_profit
            }
        }

    def generate_balance_sheet(self):
        """
        Calculates Balance Sheet in T-Format style.
        Filters Trial Balance for Assets and Liabilities and calculates total size.
        """
        tb = self.generate_hierarchical_trial_balance()
        pnl = self.generate_pnl()
        net_profit = pnl['pnl_account']['net_profit']
        
        def filter_nodes_by_names(nodes, matching_names):
            result = []
            for node in nodes:
                if node['name'] in matching_names:
                    result.append(node)
                elif node['is_group'] and node.get('children'):
                    child_matches = filter_nodes_by_names(node['children'], matching_names)
                    if child_matches:
                        new_node = dict(node)
                        new_node['children'] = child_matches
                        result.append(new_node)
            return result

        # Basic Tally Primary Group Mapping for Balance Sheet
        liabilities = filter_nodes_by_names(tb['tree'], ["Capital Account", "Loans (Liability)", "Current Liabilities", "Suspense A/c"])
        assets = filter_nodes_by_names(tb['tree'], ["Fixed Assets", "Current Assets", "Investments", "Misc. Expenses (ASSET)"])

        def get_total(nodes, is_debit_side):
            total = Decimal('0.0000')
            for node in nodes:
               val = node.get('debit') if is_debit_side else node.get('credit')
               if val: total += val
            return total
            
        total_liabilities = get_total(liabilities, False)
        total_assets = get_total(assets, True)
        
        # In Tally, Net Profit is shown on Liability side if positive, Asset side if negative (loss)
        if net_profit >= 0:
            total_liabilities += net_profit
        else:
            total_assets += abs(net_profit)

        return {
            "liabilities": liabilities,
            "assets": assets,
            "net_profit": net_profit,
            "total_liabilities": total_liabilities,
            "total_assets": total_assets
        }


