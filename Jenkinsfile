pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
    }

    tools {
        nodejs 'nodejs-22-6-0'
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }
        stage('VM Node Version') {
            steps {
                sh'''
                    node -v
                    npm -v
                '''
            }
        }
    }

    post {
        success {
            echo '✅ Build completed successfully!'
        }
        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}