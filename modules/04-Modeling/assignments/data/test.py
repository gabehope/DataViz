class AutogradValue:
    '''
    Base class for automatic differentiation operations. Represents variable delcaration.
    Subclasses will overwrite func and grads to define new operations.

    Properties:
        parents (list): A list of the inputs to the operation, may be AutogradValue or float
        args    (list): A list of raw values of each input (as floats)
        grad    (float): The derivative of the final loss with respect to this value (dL/da)
        value   (float): The value of the result of this operation
    '''

    def __init__(self, *args):
        self.parents = list(args)
        self.args = [arg.value if isinstance(arg, AutogradValue) else arg for arg in self.parents]
        self.grad = 0.
        self.value = self.forward_pass()

    def func(self, input):
        '''
        Compute the value of the operation given the inputs.
        For declaring a variable, this is just the identity function (return the input).

        Args:
            input (float): The input to the operation
        Returns:
            value (float): The result of the operation
        '''
        return input

    def grads(self, *args):
        '''
        Compute the derivative of the operation with respect to each input.
        In the base case the derivative of the identity function is just 1. (da/da = 1).

        Args:
            input (float): The input to the operation
        Returns:
            grads (tuple): The derivative of the operation with respect to each input
                            Here there is only a single input, so we return a length-1 tuple.
        '''
        return (1,)
    
    def forward_pass(self):
        # Calls func to compute the value of this operation 
        return self.func(*self.args)
    
    def backward_pass(self):
        local_grads = self.grads(*self.args)

        # Loop through pairs of parents and their corresponding grads
        for node, grad in zip(self.parents, local_grads):
            # Update the gradient of each AutogradValue parent
            if isinstance(node, AutogradValue):
                node.grad += self.grad * grad

    def backward(self):
        # We call backward on the loss, so dL/dL = 1
        self.grad = 1.
        queue = [self]
        order = []

        # Additionally keep track of the visit counts for each node
        counts = {}
        while len(queue) > 0:
            node = queue.pop()
            
            # Rather than removing nodes from the order [slow, O(N)], 
            # just mark that it has been visited again [O(1)]
            if isinstance(node, AutogradValue):
                if node in counts:
                    counts[node] += 1
                else:
                    counts[node] = 1

                order.append(node)
                queue.extend(node.parents)
        
        # Go through the order, but only call backward pass once we're at
        # the last vist for a given node
        for node in order:
            counts[node] -= 1
            if counts[node] == 0:
                node.backward_pass()